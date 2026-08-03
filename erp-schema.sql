-- ============================================================
-- ERP پولاد تجهیز آپادانا — اسکریپت دیتابیس PostgreSQL
-- دامنه ۱: پایه/پشتیبان (BusinessPartner, User/Role, ItemCatalog, Currency)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- برای gen_random_uuid()

-- ------------------------------------------------------------
-- کاربران و نقش‌ها
-- ------------------------------------------------------------

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(30),
    mobile          VARCHAR(30),   -- موبایل، جدا از تلفن ثابت
    email           VARCHAR(200) UNIQUE,
    profile_photo_url TEXT,   -- تصویر پروفایل
    -- ⚠️ اطلاعات هویتی الزامی (منابع انسانی/حراست)
    birth_date          DATE,
    national_id         VARCHAR(20),   -- کد ملی
    birth_certificate_no VARCHAR(20),  -- شماره شناسنامه
    address              TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- تصاویر مدارک هویتی — کارت ملی و تمام صفحات شناسنامه (چندتایی)
CREATE TABLE user_identity_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type   VARCHAR(30) NOT NULL
                        CHECK (document_type IN ('national_id_card', 'birth_certificate_page')),
    page_number     INTEGER,   -- برای شناسنامه که چند صفحه‌ست؛ کارت ملی معمولاً NULL یا ۱
    file_url        TEXT NOT NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 0002_auth_fields — احراز هویت (فاز ۱، قبل از هر پیاده‌سازی؛ اینجا هیچ‌وقت سنکرون نشده بود)
ALTER TABLE users
    ADD COLUMN password_hash                    TEXT NOT NULL,
    ADD COLUMN password_reset_token              VARCHAR(255),
    ADD COLUMN password_reset_token_expires_at   TIMESTAMPTZ,
    ADD COLUMN requested_department              VARCHAR(50);   -- واحد درخواستی هنگام ثبت‌نام (تا قبل از تأیید مدیر)

-- Migration 0026_bilingual_names (فاز ۳۹) — نام لاتین کاربر، برای اسناد PDF/Word پیشنهاد به زبان انگلیسی
ALTER TABLE users ADD COLUMN full_name_en VARCHAR(200);

-- توکن‌های Refresh JWT — هر کاربر می‌تونه هم‌زمان چند نشست (چند دستگاه) داشته باشه
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    user_agent  TEXT,
    ip_address  VARCHAR(64),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ============================================================
-- سیستم دسترسی (RBAC) — دسترسی‌های ریز + گروه‌های دسترسی
-- ============================================================

-- فهرست تمام دسترسی‌های ریز سیستم، دسته‌بندی‌شده بر اساس ماژول/بخش
-- در عمل ممکنه هر بخش (مثلاً «استعلام‌ها») ده‌ها دسترسی مجزا داشته باشه
CREATE TABLE permissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module              VARCHAR(50) NOT NULL,   -- مثلاً 'inquiry', 'rfq', 'selection', 'proposal', 'outcome',
                                                 -- 'order', 'po', 'shipping', 'settlement', 'business_partners',
                                                 -- 'users', 'item_catalog'
    permission_key      VARCHAR(100) NOT NULL UNIQUE,  -- مثلاً 'inquiry.create', 'inquiry.view_price'
    permission_label     VARCHAR(300) NOT NULL,  -- توضیح فارسی برای نمایش در چک‌باکس
    supports_limit       BOOLEAN NOT NULL DEFAULT false  -- آیا این دسترسی می‌تونه سقف عددی داشته باشه (مثلاً سقف مبلغ قرارداد)
);

-- گروه‌های دسترسی — هم گروه‌های پیش‌فرض (بازرگانی/مالی/فروش/مدیریت) هم گروه‌های سفارشی مدیر
CREATE TABLE permission_groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name      VARCHAR(150) NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,  -- گروه‌های پیش‌فرض سیستم؛ گروه‌های سفارشی توسط مدیر ساخته می‌شن
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- کدام دسترسی‌ها در کدام گروه فعال هستن (چک‌باکس‌های تیک‌خورده)
CREATE TABLE permission_group_items (
    permission_group_id UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
    permission_id        UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    limit_value           NUMERIC(18,2),  -- در صورتی که permissions.supports_limit=true باشه (مثلاً سقف مبلغ قرارداد)
    PRIMARY KEY (permission_group_id, permission_id)
);

-- هر کاربر دقیقاً به یک گروه دسترسی وصله (نه چند نقش هم‌زمان)
ALTER TABLE users
    ADD COLUMN permission_group_id UUID REFERENCES permission_groups(id);

-- ------------------------------------------------------------
-- طرف‌های تجاری (مشتری/تأمین‌کننده) و رابطین
-- ------------------------------------------------------------

CREATE TABLE business_partners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_type    VARCHAR(20) NOT NULL
                        CHECK (partner_type IN ('customer', 'supplier', 'both', 'freight_forwarder', 'organization', 'bank', 'service_company')),
    company_name    VARCHAR(300) NOT NULL,
    country         VARCHAR(100),
    industry        VARCHAR(150),
    address         TEXT,
    tax_id          VARCHAR(100),
    -- ⚠️ فیلدهای اختصاصی شرکت‌های داخلی (ایرانی) — فقط وقتی country = 'ایران' در UI نمایش داده می‌شن
    province             VARCHAR(100),   -- استان
    city                 VARCHAR(100),   -- شهر
    postal_code          VARCHAR(20),    -- کد پستی
    phone                VARCHAR(30),    -- تلفن ثابت شرکت
    email                VARCHAR(200),   -- ایمیل عمومی شرکت
    national_id          VARCHAR(20),    -- شناسه ملی
    registration_number  VARCHAR(50),    -- شماره ثبت
    notes                TEXT,           -- ملاحظات آزاد
    created_by      UUID REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ایندکس کمکی برای هشدار شباهت نام هنگام ثبت (جستجوی متنی فازی در سطح اپلیکیشن/pg_trgm)
CREATE INDEX idx_business_partners_company_name ON business_partners USING gin (company_name gin_trgm_ops);

-- Migration 0005_feedback_pack — چند شماره تلفن هم‌زمان، فکس، تاریخ ثبت، لوگو، شرکت خارجی/داخلی
ALTER TABLE business_partners
    ADD COLUMN phones             JSONB,   -- آرایه شماره تلفن‌ها (چندتایی، جایگزین phone تکی برای UI جدید)
    ADD COLUMN fax                VARCHAR(30),
    ADD COLUMN registration_date  DATE,
    ADD COLUMN logo_url           TEXT,
    ADD COLUMN is_foreign         BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE partner_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      UUID NOT NULL REFERENCES business_partners(id) ON DELETE CASCADE,
    contact_name    VARCHAR(200) NOT NULL,
    contact_type    VARCHAR(30)
                        CHECK (contact_type IN ('technical', 'financial', 'commercial', 'other')),
    level           VARCHAR(20)   -- سطح سازمانی (کارشناس/مدیر/مدیرعامل) — به‌جای «سمت» متنی، ترکیبی محدود
                        CHECK (level IN ('expert', 'manager', 'ceo')),
    phone           VARCHAR(30),
    mobile          VARCHAR(30),  -- شماره موبایل، جدا از تلفن ثابت
    email           VARCHAR(200),
    department      VARCHAR(150),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 0005_feedback_pack — داخلی تلفن، عکس رابط، ملاحظات آزاد
ALTER TABLE partner_contacts
    ADD COLUMN extension  VARCHAR(20),
    ADD COLUMN photo_url  TEXT,
    ADD COLUMN notes      TEXT;

-- Migration 0023_partner_bilingual_fields (فاز ۳۷) — پیش‌نیاز پیشنهاد/پیش‌فاکتور دوزبانه (فاز ۳۸)
-- تلفن/ایمیل عمداً دوزبانه نشدن (بازخورد صریح کاربر) — فقط نام و آدرس
ALTER TABLE business_partners ADD COLUMN company_name_en VARCHAR(300);
ALTER TABLE business_partners ADD COLUMN address_en        TEXT;
ALTER TABLE partner_contacts  ADD COLUMN contact_name_en VARCHAR(200);

-- ------------------------------------------------------------
-- کاتالوگ کالا
-- ------------------------------------------------------------

CREATE TABLE item_catalog (
    item_code               VARCHAR(100) PRIMARY KEY,
    item_description        TEXT NOT NULL,
    builder                 VARCHAR(200),
    default_measurement_unit VARCHAR(30),
    created_by              UUID REFERENCES users(id),
    status                   VARCHAR(20) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'inactive')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_catalog_description ON item_catalog USING gin (item_description gin_trgm_ops);

-- Migration 0005_feedback_pack — پارت نامبر به‌عنوان فیلد اصلی کالا + کد سیستمی + واحدهای اندازه‌گیری
-- ⚠️ داده‌های موجود: کد فعلی (item_code) در واقع پارت نامبر بوده — برای همین بک‌فیل از خود item_code انجام می‌شه
ALTER TABLE item_catalog ADD COLUMN part_number VARCHAR(200);
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

-- فاز ۲۵ — پیوست فایل در سطح کالا (نقشه/کاتالوگ/دیتاشیت)
-- چون کلید اصلی item_catalog یک کلید طبیعی (item_code) است نه UUID، ستون FK این جدول
-- هم VARCHAR(100) است، نه UUID — بر خلاف الگوی inquiry_item_documents
CREATE TABLE item_catalog_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code    VARCHAR(100) NOT NULL REFERENCES item_catalog(item_code) ON DELETE CASCADE,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- ارز و نرخ تبدیل
-- ------------------------------------------------------------

CREATE TABLE currencies (
    currency_code   VARCHAR(3) PRIMARY KEY,       -- کد ISO مانند USD, EUR, AED, CNY, IRR
    currency_name   VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive'))
);

-- ارزهای پرکاربرد شرکت (Seed Data)
INSERT INTO currencies (currency_code, currency_name) VALUES
    ('EUR', 'یورو'),
    ('USD', 'دلار آمریکا'),
    ('TRY', 'لیر جدید ترکیه'),
    ('PLN', 'زلوتی لهستان'),
    ('AED', 'درهم امارات'),
    ('CNY', 'یوان چین'),
    ('GBP', 'پوند انگلیس'),
    ('IRR', 'ریال ایران');

CREATE TABLE exchange_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code   VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    rate_date       DATE NOT NULL,
    rate_to_irr     NUMERIC(18,4) NOT NULL,
    source          VARCHAR(100),  -- نام API/سرویس خارجی -- نیاز به مشخص شدن در فاز پیاده‌سازی
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (currency_code, rate_date)
);

-- ------------------------------------------------------------
-- شرکت‌های گروه ما (نه طرف تجاری خارجی) — هر استعلام/خرید از تأمین‌کننده باید
-- از طریق یکی از این شرکت‌ها (شعبه‌های ما در کشورهای مختلف) انجام بشه
-- ------------------------------------------------------------

CREATE TABLE our_entities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name     VARCHAR(200) NOT NULL,   -- مثلاً «General Trading srl»، «Landa Controls»، «Pasifik Global Makina»، «پولاد تجهیز آپادانا»
    short_code      VARCHAR(10) NOT NULL UNIQUE,  -- کد اختصاری شماره‌گذاری نامه — فارسی با فاصله برای شرکت ایرانی (مثلاً «پ ت»)، لاتین برای شرکت‌های خارجی (مثلاً «GT»)
    calendar_type   VARCHAR(10) NOT NULL DEFAULT 'jalali'
                        CHECK (calendar_type IN ('jalali', 'gregorian')),  -- شرکت ایرانی: شمسی — شرکت‌های خارجی: میلادی
    country         VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive'))
);

-- Migration 0022_our_entities_admin_fields (فاز ۳۶) — بخش مدیریتی «شرکت‌های ما»
-- جایگزین seed ثابت؛ entity_name_en برای پیشنهاد/پیش‌فاکتور دوزبانه (فاز ۳۷)، بقیه برای سربرگ/تماس
ALTER TABLE our_entities
    ADD COLUMN entity_name_en VARCHAR(200),
    ADD COLUMN address        TEXT,
    ADD COLUMN phone          VARCHAR(30),
    ADD COLUMN email          VARCHAR(200),
    ADD COLUMN website        VARCHAR(200),
    ADD COLUMN logo_url       TEXT;

-- Migration 0024_our_entities_footer_fields (فاز ۳۸) — فوتر سند پیشنهاد PDF/Word
ALTER TABLE our_entities ADD COLUMN postal_code         VARCHAR(20);
ALTER TABLE our_entities ADD COLUMN registration_number  VARCHAR(50);

-- Migration 0026_bilingual_names (فاز ۳۹) — آدرس انگلیسی شرکت، برای سند پیشنهاد نسخه انگلیسی
ALTER TABLE our_entities ADD COLUMN address_en TEXT;

-- ------------------------------------------------------------
-- تنظیمات سراسری سامانه (فعلاً فقط پس‌زمینه صفحه ورود) — الگوی تک‌ردیفی (singleton)
-- دقیقاً کپی catalog_counters؛ سرویس بک‌اند ردیف id=1 رو به‌صورت لِیزی upsert می‌کنه
-- ------------------------------------------------------------

-- Migration 0032_site_settings (فاز ۴۱-ب)
CREATE TABLE site_settings (
    id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    login_background_url  TEXT,
    updated_by            UUID REFERENCES users(id),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- دامنه ۲: استعلام (Inquiry)
-- ============================================================

CREATE TABLE inquiries (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_number         VARCHAR(50) UNIQUE NOT NULL,  -- شماره داخلی سیستم (خودکار، مثلاً INQ-2026-0417)
    inquiry_number          VARCHAR(100),                 -- شماره استعلام/مناقصه — توسط کارشناس وارد می‌شه (مرجع طرف مشتری)
    buyer_id                UUID NOT NULL REFERENCES business_partners(id),
    buyer_contact_id        UUID REFERENCES partner_contacts(id),
    subject                 VARCHAR(300) NOT NULL,
    offer_end_date          DATE NOT NULL,
    extended_offer_end_date DATE,                      -- در صورت تمدید مهلت
    is_equivalent_accepted  BOOLEAN,                    -- آیا تایپ معادل قابل قبوله (سطح کل استعلام)
    settlement_terms        TEXT,                       -- شرح شرایط تسویه/پرداخت مدنظر مشتری
    advance_payment_available BOOLEAN,
    description             TEXT,                       -- توضیحات/کامنت آزاد
    sales_expert_id         UUID NOT NULL REFERENCES users(id),   -- مسئول نهایی
    created_by_user_id      UUID NOT NULL REFERENCES users(id),   -- ثبت‌کننده واقعی (ممکنه مدیر باشه)
    inquiry_start_date      DATE NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'in_progress'
                                CHECK (status IN ('in_progress', 'won', 'lost', 'partially_won', 'cancelled', 'suspended')),
    channel                 VARCHAR(30)
                                CHECK (channel IN ('email', 'phone', 'in_person', 'tender_system')),
    urgency                 VARCHAR(20) DEFAULT 'normal'
                                CHECK (urgency IN ('normal', 'urgent')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- شمارنده اتمیک شماره داخلی استعلام (INQ-YYYY-NNNN) — هر سال از نو شروع می‌شه
CREATE TABLE inquiry_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);

-- بازخورد فاز ۵ — حذف نرم پرونده به‌جای حذف قطعی؛ بازگردانی/حذف قطعی با inquiry.purge
ALTER TABLE inquiries
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by UUID REFERENCES users(id);

-- توجه: تعداد اقلام (item_count) به‌صورت خودکار محاسبه می‌شه، نه ستون ذخیره‌شده:
-- SELECT COUNT(*) FROM inquiry_items WHERE inquiry_id = ...

CREATE TABLE inquiry_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    row_index           INTEGER NOT NULL,
    item_code           VARCHAR(100) NOT NULL REFERENCES item_catalog(item_code),
    description         TEXT NOT NULL,
    quantity            NUMERIC(18,4) NOT NULL,
    measurement_unit    VARCHAR(30) NOT NULL,
    equivalent_type     VARCHAR(200),
    drawing_type_row    VARCHAR(200),
    part_number         VARCHAR(200),
    drawing_number      VARCHAR(200),
    builder             VARCHAR(200),
    serial_number       VARCHAR(200),
    -- selected_offer_id به‌عنوان FK در دامنه ۳ (بعد از ساخت جدول supplier_offers) با ALTER TABLE اضافه می‌شه
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, row_index)
);

CREATE TABLE inquiry_item_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id) ON DELETE CASCADE,
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(300),
    uploaded_by         UUID REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 0031_inquiry_documents (فاز ۴۱) — پیوست‌های کلی سطح استعلام، جدا از inquiry_item_documents
-- (پیوست هر ردیف کالا) — برای فایل‌هایی که به کل پرونده مربوطن، نه یک ردیف خاص. هم‌الگوی دقیق بالا.
CREATE TABLE inquiry_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(300),
    uploaded_by         UUID REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inquiry_documents_inquiry ON inquiry_documents(inquiry_id);

-- بخش گفتگو/کامنت‌گذاری داخلی در سطح کل استعلام
-- ⚠️ این جدول حالا یک فید ترکیبیه: هم چت آزاد بین افراد، هم لاگ خودکار همه فعالیت‌های مهم پرونده
-- (تکمیل مرحله، بارگذاری فایل، تغییر وضعیت و...) به همراه نام عامل هر اقدام
CREATE TABLE inquiry_discussions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    entry_type          VARCHAR(20) NOT NULL DEFAULT 'message'
                            CHECK (entry_type IN ('message', 'activity')),  -- message = چت آزاد کاربر | activity = لاگ خودکار سیستم
    author_id           UUID NOT NULL REFERENCES users(id),   -- برای activity هم پر می‌شه: کاربری که آن اقدام را انجام داده
    comment_text        TEXT NOT NULL,   -- برای message: متن چت | برای activity: توضیح خودکار تولیدشده (مثلاً «فایل X را بارگذاری کرد»)
    tag                 VARCHAR(30) DEFAULT 'general'
                            CHECK (tag IN ('general', 'technical_question', 'file_upload', 'status_change', 'stage_completed', 'approval')),
    metadata            JSONB,   -- جزئیات ساختاریافته اقدام خودکار (مثلاً {"file_name": "...", "module": "rfq"})
    -- source_rfq_id به‌عنوان FK در دامنه ۳ (بعد از ساخت جدول supplier_rfqs) با ALTER TABLE اضافه می‌شه
    mentioned_user_id   UUID REFERENCES users(id),   -- اشاره/Mention اختیاری به یک کارشناس خاص
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- نکته معماری مهم: هر ماژولی که روی یک پرونده استعلام کاری انجام می‌ده (RFQ، انتخاب نهایی، پیشنهاد،
-- سفارش، PO، حمل، تسویه) باید هنگام اقدامات مهم (نه هر تغییر جزئی) یک رکورد entry_type='activity'
-- اینجا درج کنه — این یک Cross-Cutting Concern در سطح اپلیکیشنه، نه منطق یک ماژول خاص

-- Migration 0019_inquiry_commercial_confidentiality (فاز ۳۴) — نسخه‌ی عمومیِ بدون جزئیات بازرگانی
-- حساس (نام تأمین‌کننده، مبلغ) برای ورودی‌های entry_type='activity'؛ NULL یعنی این ورودی نیاز به
-- نسخه‌ی محدود نداره (پیام‌های آزاد کاربر، یا ورودی‌هایی که از اول عمومی‌ان) و comment_text کامل
-- برای همه نمایش داده می‌شه. کاربرانی که دسترسی inquiry.view_commercial_details ندارن (فروش)
-- در سطح اپلیکیشن به‌جای comment_text همین ستون رو می‌بینن (وقتی پر باشه).
ALTER TABLE inquiry_discussions ADD COLUMN comment_text_restricted TEXT;

-- ============================================================
-- دامنه ۳: تأمین (SupplierRFQ, SupplierOffer)
-- ============================================================

CREATE TABLE supplier_rfqs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_number          VARCHAR(50) UNIQUE NOT NULL,
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id),
    supplier_id         UUID NOT NULL REFERENCES business_partners(id),  -- partner_type = supplier
    our_entity_id       UUID NOT NULL REFERENCES our_entities(id),  -- کدام شرکت گروه ما این RFQ را ارسال می‌کند
    commercial_expert_id UUID NOT NULL REFERENCES users(id),
    email_subject       VARCHAR(300),
    sent_date           DATE NOT NULL,
    response_due_date   DATE,   -- مهلت پیش‌فرض قابل‌تنظیم برای تغییر خودکار وضعیت به no_response
    status              VARCHAR(30) NOT NULL DEFAULT 'awaiting_response'
                            CHECK (status IN ('awaiting_response', 'no_response', 'technical_question', 'offer_received')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- شمارنده اتمیک شماره RFQ — هر سال از نو شروع می‌شه
CREATE TABLE rfq_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);

-- تکمیل ارجاع خودکار سوال فنی از RFQ به گفتگوی استعلام (دامنه ۲)
ALTER TABLE inquiry_discussions
    ADD COLUMN source_rfq_id UUID REFERENCES supplier_rfqs(id);

-- ردیف‌های انتخاب‌شده از استعلام برای این RFQ خاص (زیرمجموعه‌ای از inquiry_items)
CREATE TABLE rfq_items (
    rfq_id              UUID NOT NULL REFERENCES supplier_rfqs(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id) ON DELETE CASCADE,
    PRIMARY KEY (rfq_id, inquiry_item_id)
);

CREATE TABLE supplier_offers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id              UUID NOT NULL REFERENCES supplier_rfqs(id),
    offer_number        VARCHAR(100),      -- شماره‌ای که خود تأمین‌کننده به آفرش داده
    offer_date          DATE,              -- تاریخ درج‌شده روی سند آفر توسط تأمین‌کننده (اختیاری)
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),  -- لحظه واقعی ثبت پاسخ در سیستم — خودکار، غیرقابل‌ویرایش، مبنای گزارش سرعت پاسخ‌دهی
    offer_contact_name  VARCHAR(200),      -- شخص آفردهنده نزد تأمین‌کننده
    vat_applicable      BOOLEAN NOT NULL DEFAULT false,
    vat_rate_percent    NUMERIC(5,2),      -- درصد VAT در صورت اعمال
    other_costs         NUMERIC(18,4) DEFAULT 0,  -- حمل، بسته‌بندی و سایر هزینه‌های جانبی این آفر
    distribute_costs    BOOLEAN NOT NULL DEFAULT false,  -- توزیع VAT+سایر هزینه‌ها به نسبت قیمت بین اقلام این آفر (تصمیم مدیریت در مرحله انتخاب نهایی)
    general_remarks     TEXT,              -- سایر ملاحظات کلی آفر (برای استفاده در آماده‌سازی پیشنهاد فنی)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- جمع کل پیش‌فاکتور در سطح اپلیکیشن محاسبه می‌شه:
-- SUM(supplier_offer_items.price * inquiry_items.quantity) + VAT + other_costs
-- گزارش سرعت پاسخ‌دهی هر تأمین‌کننده: AVG(supplier_offers.received_at - supplier_rfqs.sent_date)

-- Migration 0020_selection_distribute_vat_costs_split (فاز ۳۵-الف) — توزیع VAT از توزیع سایر
-- هزینه‌ها مستقل شد. ⚠️ distribute_costs جایگزین/حذف نمی‌شه (Rollback-پذیری) — فقط از این پس
-- نه خونده می‌شه نه نوشته می‌شه؛ داده‌ی موجود به‌عنوان بک‌فیل روی هر دو سوییچ جدید کپی شد.
ALTER TABLE supplier_offers ADD COLUMN distribute_vat BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE supplier_offers ADD COLUMN distribute_other_costs BOOLEAN NOT NULL DEFAULT false;
UPDATE supplier_offers SET distribute_vat = distribute_costs, distribute_other_costs = distribute_costs;

CREATE TABLE supplier_offer_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id            UUID NOT NULL REFERENCES supplier_offers(id) ON DELETE CASCADE,
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(300),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جزئیات قیمت/فنی هر قلم در یک آفر مشخص
CREATE TABLE supplier_offer_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id            UUID NOT NULL REFERENCES supplier_offers(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id),
    price               NUMERIC(18,4) NOT NULL,
    currency_code       VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    delivery_time_days  INTEGER,
    part_number         VARCHAR(200),   -- پارت‌نامبر تأمین‌کننده برای این قلم — برای تهیه پیشنهاد فنی
    country_of_origin  VARCHAR(100),   -- کشور سازنده واقعی کالا (ممکنه با کشور تأمین‌کننده فرق داشته باشه)
    is_equivalent       BOOLEAN NOT NULL DEFAULT false,  -- آیا کالای معادل پیشنهاد شده (نه برند/مدل دقیق درخواستی)
    technical_specs     TEXT,           -- شرح کالا و مشخصات فنی ارائه‌شده — ممکنه با درخواست اولیه فرق داشته باشه
    datasheet_url        TEXT,           -- فایل دیتاشیت/کاتالوگ پیوستی این قلم
    payment_terms       TEXT,
    offer_validity_date DATE,
    UNIQUE (offer_id, inquiry_item_id)
);

-- انتخاب آفر نهایی برای هر قلم استعلام (در سطح هر ردیف، نه کل استعلام) + معیارهای کیفی انتخاب
-- این فیلدها توسط مدیریت/مدیر فروش در مرحله «انتخاب نهایی و قیمت‌گذاری» پر می‌شن (جدا از مرحله ثبت آفر توسط بازرگانی)
ALTER TABLE inquiry_items
    ADD COLUMN selected_offer_item_id UUID REFERENCES supplier_offer_items(id),
    ADD COLUMN selection_notes TEXT,               -- سابقه همکاری/کیفیت/ریسک ارزی و سایر معیارهای کیفی انتخاب مدیریت
    ADD COLUMN markup_percent NUMERIC(6,3),         -- درصد حاشیه سود این قلم (تعیین مدیریت)
    ADD COLUMN final_sale_price NUMERIC(18,4);      -- قیمت فروش نهایی این قلم (خودکار محاسبه، قابل اصلاح دستی مدیریت)

-- فیلدهای سطح کل استعلام مربوط به قفل‌شدن مرحله «انتخاب نهایی»
ALTER TABLE inquiries
    ADD COLUMN manager_note_to_sales TEXT,           -- یادداشت مدیر خطاب به کارشناس فروش، بعد از قفل شدن نمایش داده می‌شود
    ADD COLUMN selection_locked_at TIMESTAMPTZ,      -- زمان قفل‌شدن مرحله انتخاب نهایی توسط مدیریت
    ADD COLUMN selection_locked_by UUID REFERENCES users(id);
-- نکته: تولید پیشنهاد مالی/فنی (دامنه ۴) در سطح اپلیکیشن فقط وقتی مجاز است که selection_locked_at پر شده باشد

-- گزینه‌های ترم تحویل (Incoterm) — ممکن است مدیریت هم‌زمان چند ترم (مثلاً EXW/CPT/DDP) به مشتری پیشنهاد بدهد،
-- هرکدام با هزینه اضافه و زمان تحویل مخصوص خودش (چون گمرک/بیمه/حمل مسئولیت متفاوتی در هر ترم دارد)
CREATE TABLE inquiry_delivery_options (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    delivery_term       VARCHAR(10) NOT NULL
                            CHECK (delivery_term IN ('EXW', 'CPT', 'DDP', 'CIF', 'FOB')),
    extra_cost          NUMERIC(18,4) NOT NULL DEFAULT 0,  -- هزینه اضافه این ترم نسبت به قیمت پایه (معمولاً EXW)
    delivery_days       INTEGER NOT NULL,                  -- زمان تحویل مختص این ترم (DDP معمولاً به‌خاطر ترخیص بیشتره)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, delivery_term)
);

-- ============================================================
-- دامنه ۴: پیشنهاد به مشتری + نتیجه نهایی استعلام (برد/باخت)
-- ============================================================

CREATE TABLE financial_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_number     VARCHAR(50) NOT NULL,
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id),
    version             INTEGER NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'current'
                            CHECK (status IN ('current', 'superseded')),
    prepared_date       DATE NOT NULL,
    currency_code       VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    chosen_delivery_term VARCHAR(10) NOT NULL,  -- کدام گزینه از inquiry_delivery_options برای این نسخه انتخاب شده
    delivery_days       INTEGER NOT NULL,       -- زمان تحویل همان ترم — در پیشنهاد قید می‌شود
    payment_terms       TEXT,
    proposal_validity_date DATE,
    negotiation_note    TEXT,
    file_url            TEXT,   -- خروجی رسمی PDF/Word
    sent_at             TIMESTAMPTZ,  -- لحظه ثبت نهایی/ارسال این نسخه به مشتری؛ خالی یعنی هنوز پیش‌نویس/در حال مذاکره
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, version)
);

CREATE TABLE financial_proposal_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_proposal_id UUID NOT NULL REFERENCES financial_proposals(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id),
    purchase_price      NUMERIC(18,4) NOT NULL,   -- خودکار از supplier_offer_items منتخب همون قلم
    markup_percent      NUMERIC(6,3) NOT NULL,    -- درصد پایه وارد شده توسط مدیریت (کپی از inquiry_items در زمان ساخت این نسخه)
    final_sale_price    NUMERIC(18,4) NOT NULL,   -- ⚠️ قیمت واقعی همین نسخه پیشنهاد — قابل ویرایش توسط کارشناس فروش طی مذاکره، مستقل از inquiry_items.final_sale_price (که فقط مبنای اولیه مدیریته و هیچ‌وقت تغییر نمی‌کنه)
    UNIQUE (financial_proposal_id, inquiry_item_id)
);
-- نکته کلیدی: وقتی مذاکره با مشتری باعث تغییر قیمت می‌شه، به‌جای اصلاح قیمت پایه،
-- یک نسخه جدید از financial_proposals ساخته می‌شه و قیمت جدید در financial_proposal_items همون نسخه ثبت می‌شه.
-- به این ترتیب کل تاریخچه مذاکره (چه قیمتی در چه نسخه‌ای پیشنهاد شده) قابل بازیابی می‌مونه.

-- Migration 0021_financial_proposal_price_change_requests (فاز ۳۵-ج) — گردش تأیید مدیر وقتی
-- کارشناس فروش قیمتی کمتر از inquiry_items.final_sale_price (خط پایهٔ مدیریت) وارد می‌کنه؛
-- هم‌ساختار shipment_edit_requests (فاز ۲۷). تا زمان تأیید/رد، financial_proposal_items.final_sale_price
-- دست‌نخورده می‌مونه — قیمت درخواستی فقط اینجا ذخیره می‌شه.
CREATE TABLE financial_proposal_price_change_requests (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_proposal_item_id  UUID NOT NULL REFERENCES financial_proposal_items(id) ON DELETE CASCADE,
    requested_price             NUMERIC(18,4) NOT NULL,
    requested_by                UUID NOT NULL REFERENCES users(id),
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by                  UUID REFERENCES users(id),
    decided_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_change_requests_item ON financial_proposal_price_change_requests(financial_proposal_item_id, status);

CREATE TABLE technical_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_number     VARCHAR(50) NOT NULL,
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id),
    version             INTEGER NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'current'
                            CHECK (status IN ('current', 'superseded')),
    prepared_date       DATE NOT NULL,
    delivery_time_estimate_days INTEGER,  -- هماهنگ با chosen_delivery_term همون نسخه در financial_proposals
    negotiation_note    TEXT,
    file_url            TEXT,   -- خروجی رسمی PDF/Word
    sent_at             TIMESTAMPTZ,  -- لحظه ثبت نهایی/ارسال این نسخه به مشتری
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inquiry_id, version)
);

-- Migration 0025_proposal_our_entity (فاز ۳۸) — شرکت گروه صادرکننده این نسخه از پیشنهاد
-- (برای سربرگ سند PDF/Word)؛ Nullable و قفل‌شده در سطح نسخه، هم‌الگوی currency_code/
-- chosen_delivery_term که قبلاً per-version بودن. اگه NULL باشه (نسخه‌های قدیمی‌تر قبل از
-- این فاز)، سطح اپلیکیشن fallback به شرکت ایرانی گروه (short_code='پ ت') می‌کنه، نه ستون.
ALTER TABLE financial_proposals ADD COLUMN our_entity_id UUID REFERENCES our_entities(id);
ALTER TABLE technical_proposals ADD COLUMN our_entity_id UUID REFERENCES our_entities(id);

-- Migration 0027_proposal_counters (فاز ۴۰-ب) — شمارنده اتمیک شماره پیشنهاد مالی/فنی بر مبنای
-- شرکت گروه صادرکننده، هم‌الگوی letter_counters؛ جدول مستقل تا شمارش نامه‌ها و پیشنهادها به‌هم
-- قاطی نشه. هر نسخه‌ی جدید (v1 و هر اصلاح) یک شماره تازه می‌گیره تا تاریخچه‌ی کامل پیشنهادهای
-- صادرشده توسط هر شرکت گروه قابل ردیابی باشه (فرمت: {سال}-{short_code}-{سریال ۴رقمی}).
CREATE TABLE proposal_counters (
    year            INTEGER NOT NULL,
    our_entity_id   UUID NOT NULL REFERENCES our_entities(id),
    last_serial     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, our_entity_id)
);

CREATE TABLE technical_proposal_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technical_proposal_id UUID NOT NULL REFERENCES technical_proposals(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id),
    technical_specs     TEXT,
    compliance_note     TEXT,
    UNIQUE (technical_proposal_id, inquiry_item_id)
);

-- نتیجه نهایی هر قلم استعلام (برد/باخت) — نقطه کلیدی تحلیل آینده
-- ⚠️ در سطح هر قلم ثبت می‌شه، نه کل استعلام، چون مشتری می‌تونه بعضی اقلام رو به ما بده و بعضی رو به رقیب
CREATE TABLE inquiry_item_outcomes (
    inquiry_item_id     UUID PRIMARY KEY REFERENCES inquiry_items(id) ON DELETE CASCADE,
    result              VARCHAR(20) NOT NULL
                            CHECK (result IN ('won', 'lost', 'cancelled', 'pending')),
    decision_date       DATE,
    loss_reason         VARCHAR(50)
                            CHECK (loss_reason IN (
                                'higher_price', 'delivery_time', 'technical_mismatch',
                                'customer_requirement_change', 'customer_project_cancelled', 'other'
                            )),
    competitor_name     VARCHAR(200),
    competitor_price    NUMERIC(18,4),
    win_reason          VARCHAR(100),
    expert_note         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- وضعیت کلی استعلام (inquiries.status) بر مبنای جمع نتایج اقلام در سطح اپلیکیشن به‌روزرسانی می‌شه:
-- همه won → 'won' | همه lost → 'lost' | ترکیبی → 'partially_won' | هنوز کامل نشده → 'in_progress'

-- ============================================================
-- دامنه ۵: اجرای سفارش (Order, PurchaseOrder, پرداخت‌ها، ضمانت‌نامه)
-- ============================================================

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        VARCHAR(50) UNIQUE NOT NULL,
    inquiry_id          UUID NOT NULL REFERENCES inquiries(id),
    contract_number     VARCHAR(100),
    contract_date       DATE,
    total_amount        NUMERIC(18,4) NOT NULL,
    delivery_due_date   DATE,
    contract_file_url   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id),
    supplier_id         UUID NOT NULL REFERENCES business_partners(id),
    purchase_price      NUMERIC(18,4) NOT NULL,
    sale_price          NUMERIC(18,4) NOT NULL,
    quantity            NUMERIC(18,4) NOT NULL,
    UNIQUE (order_id, inquiry_item_id)
);

-- پرداخت مشتری — لیستی از رکوردها، نه اقساط منظم
CREATE TABLE customer_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_description VARCHAR(200),   -- پیش‌پرداخت/مانده/سایر (آزاد)
    due_date            DATE,
    amount              NUMERIC(18,4) NOT NULL,
    actual_payment_date DATE,
    payment_document_file_url TEXT,  -- پیوست سند پرداخت (فیش/رسید)
    status              VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                            CHECK (status IN ('unpaid', 'paid')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ضمانت‌نامه‌های صادرشده توسط ما به مشتری
CREATE TABLE issued_guarantees (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    guarantee_type      VARCHAR(30) NOT NULL
                            CHECK (guarantee_type IN ('advance_payment', 'performance')),
    amount              NUMERIC(18,4) NOT NULL,
    issuing_bank        VARCHAR(200),
    issue_date          DATE,
    expiry_date         DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'released', 'called')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number           VARCHAR(50) UNIQUE NOT NULL,
    order_id            UUID NOT NULL REFERENCES orders(id),
    supplier_id         UUID NOT NULL REFERENCES business_partners(id),
    our_entity_id       UUID NOT NULL REFERENCES our_entities(id),  -- شرکت گروه ما که این PO از طریقش صادر می‌شه (معمولاً همون شرکت RFQ اولیه)
    currency_code       VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    total_amount        NUMERIC(18,4) NOT NULL,
    issue_date          DATE NOT NULL,
    delivery_due_date   DATE,
    -- نوع حمل و Incoterm از اینجا حذف شد — این‌ها در فرآیند جدای «استعلام حمل» (freight_rfqs) تعیین می‌شن
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE po_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    order_item_id       UUID NOT NULL REFERENCES order_items(id),
    quantity            NUMERIC(18,4) NOT NULL,
    price                NUMERIC(18,4) NOT NULL,
    UNIQUE (po_id, order_item_id)
);

-- پرداخت به تأمین‌کننده — انعطاف‌پذیر (پیش‌پرداخت/هنگام تحویل/بعد از تحویل/ترکیبی)
CREATE TABLE supplier_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    payment_description VARCHAR(200),
    due_date            DATE,
    amount              NUMERIC(18,4) NOT NULL,
    actual_payment_date DATE,
    payment_document_file_url TEXT,  -- پیوست سند پرداخت
    payment_method      VARCHAR(50),   -- حواله ارزی/ال‌سی/...
    status              VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                            CHECK (status IN ('unpaid', 'in_progress', 'completed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- بسته‌بندی کالاهای آماده (قبل از استعلام حمل و تشکیل محموله)
-- ------------------------------------------------------------

CREATE TABLE packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID NOT NULL REFERENCES purchase_orders(id),
    package_number      VARCHAR(50) NOT NULL,   -- مثلاً «بسته ۱ از ۳»
    length_cm           NUMERIC(10,2),
    width_cm            NUMERIC(10,2),
    height_cm           NUMERIC(10,2),
    weight_kg           NUMERIC(10,2) NOT NULL,
    pickup_location     VARCHAR(200) NOT NULL,  -- نام انبار واسط یا «نزد تأمین‌کننده»
    status              VARCHAR(20) NOT NULL DEFAULT 'defining'
                            CHECK (status IN ('defining', 'ready_to_ship')),  -- فقط 'ready_to_ship' در ماژول استعلام حمل قابل انتخابه
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (po_id, package_number)
);

CREATE TABLE package_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id          UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    inquiry_item_id     UUID NOT NULL REFERENCES inquiry_items(id),
    quantity            NUMERIC(18,4) NOT NULL
);

-- ------------------------------------------------------------
-- استعلام حمل از شرکت‌های باربری — دقیقاً مشابه الگوی استعلام از تأمین‌کننده کالا،
-- ولی طرف مقابل شرکت حمل (business_partners.partner_type = 'freight_forwarder') است
-- ------------------------------------------------------------

CREATE TABLE freight_rfqs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_number              VARCHAR(50) UNIQUE NOT NULL,
    freight_company_id      UUID NOT NULL REFERENCES business_partners(id),  -- partner_type = freight_forwarder
    commercial_expert_id    UUID NOT NULL REFERENCES users(id),
    destination_customs     VARCHAR(200) NOT NULL,  -- گمرک/مرز مقصد که شرکت حمل باید کالا رو تحویل بده
    email_subject           VARCHAR(300),  -- متن پیش‌نویس ایمیل استعلام — مثل الگوی supplier_rfqs
    sent_date               DATE NOT NULL,
    status                  VARCHAR(30) NOT NULL DEFAULT 'awaiting_response'
                                CHECK (status IN ('awaiting_response', 'no_response', 'offer_received')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- کدام بسته‌ها (که ممکنه از چند PO/پرونده مختلف باشن) در این استعلام حمل گنجانده شدن
CREATE TABLE freight_rfq_packages (
    freight_rfq_id      UUID NOT NULL REFERENCES freight_rfqs(id) ON DELETE CASCADE,
    package_id          UUID NOT NULL REFERENCES packages(id),
    PRIMARY KEY (freight_rfq_id, package_id)
);

CREATE TABLE freight_offers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freight_rfq_id      UUID NOT NULL REFERENCES freight_rfqs(id),
    price               NUMERIC(18,4) NOT NULL,
    currency_code       VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    transit_time_days   INTEGER,
    offer_date          DATE,           -- تاریخ سند آفر شرکت حمل
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),  -- لحظه ثبت پاسخ — خودکار، مبنای گزارش سرعت پاسخ‌دهی
    validity_date       DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 0006_freight_shipment_counters — شمارنده‌های اتمیک شماره استعلام حمل و شماره محموله
CREATE TABLE freight_rfq_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE shipment_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- دامنه ۶: تولید نزد تأمین‌کننده، تجمیع، حمل و گمرک
-- ============================================================

-- مرحله ۱۰: پیگیری تولید/آماده‌سازی نزد تأمین‌کننده
CREATE TABLE production_tracking (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    status              VARCHAR(20) NOT NULL DEFAULT 'in_production'
                            CHECK (status IN ('in_production', 'ready_to_ship', 'in_transit')),
    estimated_ready_date DATE,
    -- وقتی status='ready_to_ship': اطلاعات محل pickup برای هماهنگی با شرکت حمل لازمه
    pickup_address       TEXT,
    pickup_phone         VARCHAR(30),
    pickup_contact_name  VARCHAR(200),
    pickup_contact_email VARCHAR(200),
    pickup_contact_phone VARCHAR(30),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- نکته: وقتی status = 'in_transit' (کالا در حال حمله)، پیگیری این PO در سطح اپلیکیشن غیرفعال/بسته می‌شه — نیازی به گزارش پیگیری دوره‌ای بیشتر نیست

CREATE TABLE production_tracking_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_tracking_id  UUID NOT NULL REFERENCES production_tracking(id) ON DELETE CASCADE,
    log_date                DATE NOT NULL,
    note                     TEXT,
    document_url             TEXT   -- مستندات کنترل کیفی تأمین‌کننده در صورت ارسال
);

-- مرحله ۱۰-ب تا ۱۲: تجمیع، حمل، اظهارنامه صادرات/واردات و ترخیص — چرخه کامل
CREATE TABLE shipments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number             VARCHAR(50) UNIQUE NOT NULL,
    commercial_expert_id        UUID NOT NULL REFERENCES users(id),
    consolidation_warehouse     VARCHAR(200),   -- نام/مکان انبار واسط در اروپا
    freight_company_id          UUID REFERENCES business_partners(id),  -- شرکت حمل منتخب (از freight_offers)
    selected_freight_offer_id   UUID REFERENCES freight_offers(id),
    destination_customs         VARCHAR(200),   -- گمرک/مرز مقصد

    -- ⚠️ چرخه وضعیت واحد و دقیق (جایگزین دو فیلد جدای قبلی consolidation_status/customs_status)
    stage                       VARCHAR(30) NOT NULL DEFAULT 'consolidating'
                                    CHECK (stage IN (
                                        'consolidating',       -- در حال تجمیع، هنوز شرکت حمل انتخاب نشده
                                        'in_transit',           -- بعد از انتخاب شرکت حمل — در حال حمل
                                        'export_declared',      -- اظهارنامه صادرات (EX1/بیانه) از شرکت حمل دریافت و بارگذاری شد
                                        'iran_docs_sent',       -- مدارک سمت ایران (ثبت سفارش، بیمه‌نامه، اینویس/پکینگ لگ دوم) آماده و ارسال شد
                                        'customs_declared',     -- بار به گمرک مقصد رسید و اظهار گمرکی انجام/بارگذاری شد
                                        'cleared'               -- هزینه‌های ترخیص ثبت شد، بار وارد انبار شد
                                    )),

    consolidation_start_date    DATE,
    consolidation_finalize_date DATE,

    -- فیلدهای حمل (مرحله in_transit)
    bill_of_lading_number       VARCHAR(100),
    loading_date                DATE,
    vessel_or_flight             VARCHAR(200),
    origin_port                  VARCHAR(150),
    destination_port             VARCHAR(150),
    eta                          DATE,

    -- اظهارنامه صادرات (EX1/بیانه) — از شرکت حمل دریافت می‌شه
    export_declaration_number    VARCHAR(100),
    export_declaration_file_url  TEXT,

    -- اظهارنامه گمرکی مقصد (بعد از رسیدن به گمرک ایران)
    customs_declaration_number   VARCHAR(100),
    customs_declaration_file_url TEXT,

    -- هزینه‌های ترخیص — دو بخش جدا طبق نیاز واقعی حسابداری
    customs_duties_amount        NUMERIC(18,4),  -- حقوق و عوارض گمرکی
    clearance_fees_amount        NUMERIC(18,4),  -- کارمزد و سایر هزینه‌های ترخیص
    clearance_agent_name         VARCHAR(200),

    -- اسناد پایانی خروج از گمرک
    weighbridge_slip_file_url     TEXT,  -- قبض باسکول
    customs_exit_waybill_file_url TEXT,  -- بارنامه خروج از گمرک

    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فاز ۲۷ — قفل مرحله: مرحله‌ای که با تأیید «درخواست اصلاح» موقتاً باز شده (NULL = مراحل گذشته طبق قانون عادی قفل‌ان)
ALTER TABLE shipments ADD COLUMN unlocked_stage VARCHAR(30);

-- کدام بسته‌ها (از چند PO/پرونده مختلف) در این محموله قرار گرفتن — واحد دقیق‌تر از PO
CREATE TABLE shipment_packages (
    shipment_id                 UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    package_id                  UUID NOT NULL REFERENCES packages(id),
    PRIMARY KEY (shipment_id, package_id)
);
-- نکته: «کدام PO ها در این محموله هستند» با JOIN از طریق packages.po_id به‌دست می‌آد؛
-- نیازی به جدول جدای shipment_pos نیست چون packages واحد دقیق‌تریه

-- فاز ۲۷ — اسناد چندفایلی محموله: هر جایگاه سند (doc_key، مثلاً 'export_invoice'، 'bill_of_lading')
-- می‌تونه چند فایل هم‌زمان داشته باشه؛ آپلود جدید اضافه می‌شه نه جایگزین. ۱۷ ستون تک‌فایلهٔ
-- *_file_url قدیمی در shipments/export_documents/import_documents از این فاز Deprecated هستن
-- (نه خونده می‌شن نه نوشته؛ فقط برای Rollback و سازگاری تاریخی باقی موندن)
CREATE TABLE shipment_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    doc_key      VARCHAR(50) NOT NULL,
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipment_documents_shipment ON shipment_documents(shipment_id, doc_key);

-- فاز ۲۷ — درخواست اصلاح مرحلهٔ قفل‌شده: کارشناس درخواست می‌ده، دارندهٔ shipping.approve_edit
-- از داخل خود اعلان (notifications.actions — اولین استفادهٔ واقعی طراحی دامنه ۹) تأیید/رد می‌کنه؛
-- تأیید یعنی shipments.unlocked_stage ست می‌شه تا درخواست‌دهنده اصلاح و بعد «پایان اصلاح» رو بزنه
CREATE TABLE shipment_edit_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id   UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    stage         VARCHAR(30) NOT NULL,
    reason        TEXT NOT NULL,
    requested_by  UUID NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by    UUID REFERENCES users(id),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE export_documents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id                 UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    invoice_number               VARCHAR(100),
    invoice_file_url             TEXT,
    packing_list_number          VARCHAR(100),
    packing_list_file_url        TEXT,
    non_dual_use_certificate_url TEXT,
    power_of_attorney_url        TEXT,
    status                       VARCHAR(20) NOT NULL DEFAULT 'preparing'
                                    CHECK (status IN ('preparing', 'complete', 'sent')),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- سایر مدارک صادراتی آزاد (قابل افزودن موارد دیگر)
CREATE TABLE export_document_attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_document_id  UUID NOT NULL REFERENCES export_documents(id) ON DELETE CASCADE,
    document_name       VARCHAR(200),
    file_url            TEXT NOT NULL,
    issue_date          DATE
);

CREATE TABLE import_documents (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id                     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    -- ⚠️ همه این مدارک («مدارک سمت ایران») هم‌زمان برای شرکت حمل ارسال و در سامانه خودمان بارگذاری می‌شن
    trade_system_registration_number VARCHAR(100),   -- ثبت سفارش سامانه جامع تجارت
    trade_system_registration_date   DATE,
    insurance_policy_number          VARCHAR(100),
    insurance_company                VARCHAR(200),
    insurance_amount                 NUMERIC(18,4),
    insurance_issue_date             DATE,
    insurance_expiry_date            DATE,
    import_invoice_number            VARCHAR(100),   -- Invoice لگ دوم
    import_invoice_file_url          TEXT,
    import_packing_list_number       VARCHAR(100),   -- Packing List لگ دوم
    import_packing_list_file_url     TEXT,
    bill_of_lading_file_url          TEXT,   -- بارنامه
    warehouse_slip_number            VARCHAR(100),   -- قبض انبار
    warehouse_slip_file_url          TEXT,
    clearance_permit_file_url        TEXT,   -- ترخیصیه یا واگذاری
    freight_invoice_rial_number      VARCHAR(100),   -- فاکتور ریالی شرکت حمل
    freight_invoice_rial_file_url    TEXT,
    freight_invoice_forex_number     VARCHAR(100),   -- فاکتور ارزی شرکت حمل
    freight_invoice_forex_file_url   TEXT,
    inspection_certificate_file_url  TEXT,   -- گواهی بازرسی
    certificate_of_origin_file_url   TEXT,   -- گواهی مبدأ
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- مرحله ۱۲: دریافت کالا در انبار — بخشی از ماژول سراسری «مدیریت بارها» (نه مختص یک پرونده)
-- چون یک محموله می‌تونه شامل اقلام چند پرونده مختلف باشه، رسید انبار به سطح shipment وصل می‌شه نه po
CREATE TABLE warehouse_receipts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id             UUID NOT NULL REFERENCES shipments(id),
    receipt_number          VARCHAR(50) UNIQUE NOT NULL,
    arrival_date            DATE NOT NULL,
    destination_warehouse   VARCHAR(200),
    packaging_condition     VARCHAR(20)
                                CHECK (packaging_condition IN ('intact', 'damaged')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⚠️ تصاویر و مقدار دریافتی به تفکیک هر قلم (نه یک‌جا برای کل رسید)
CREATE TABLE warehouse_receipt_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_receipt_id    UUID NOT NULL REFERENCES warehouse_receipts(id) ON DELETE CASCADE,
    inquiry_item_id         UUID NOT NULL REFERENCES inquiry_items(id),
    received_quantity       NUMERIC(18,4) NOT NULL,
    UNIQUE (warehouse_receipt_id, inquiry_item_id)
);

CREATE TABLE warehouse_receipt_photos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_receipt_item_id UUID NOT NULL REFERENCES warehouse_receipt_items(id) ON DELETE CASCADE,
    photo_url               TEXT NOT NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- دامنه ۷: تحویل به مشتری و تسویه نهایی
-- ============================================================

-- مرحله ۱۴: تحویل به مشتری + تایید فنی/کیفی بعدی مشتری
CREATE TABLE deliveries (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                    UUID NOT NULL REFERENCES orders(id),
    actual_delivery_date        DATE NOT NULL,
    delivery_method             VARCHAR(20)
                                    CHECK (delivery_method IN ('in_person', 'carrier')),
    recipient_name              VARCHAR(200),
    delivery_receipt_file_url   TEXT,
    customer_acceptance_date    DATE,
    customer_acceptance_status  VARCHAR(30) NOT NULL DEFAULT 'pending'
                                    CHECK (customer_acceptance_status IN ('pending', 'accepted', 'rejected_needs_action')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- توجه: مغایرت زمان تحویل واقعی با تعهدشده (orders.delivery_due_date) در سطح اپلیکیشن/View محاسبه می‌شه

-- مرحله ۱۵: صدور فاکتور نهایی (فقط بعد از تایید فنی/کیفی مشتری در deliveries)
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number      VARCHAR(50) UNIQUE NOT NULL,
    order_id            UUID NOT NULL REFERENCES orders(id),
    final_amount_irr    NUMERIC(18,2) NOT NULL,  -- جمع نهایی به ریال — از SUM(invoice_items.amount_irr) محاسبه می‌شه، نه یک نرخ ثابت
    issue_date          DATE NOT NULL,
    payment_deadline    DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⚠️ تفکیک فاکتور به بخش‌ها با نرخ ارز مجزا برای هرکدوم
-- (مثلاً پیش‌پرداخت با نرخ روز پیش‌پرداخت، مانده با نرخ روز تحویل)
CREATE TABLE invoice_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id              UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description             VARCHAR(200) NOT NULL,   -- مثلاً «پیش‌پرداخت»، «مانده»
    source_customer_payment_id UUID REFERENCES customer_payments(id),  -- لینک به رکورد پرداخت مربوطه در صورت وجود
    amount_currency         NUMERIC(18,4) NOT NULL,  -- مبلغ به ارز اصلی معامله (مثلاً یورو)
    currency_code           VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    exchange_rate_date      DATE NOT NULL,   -- تاریخ مبنای نرخ (روز پیش‌پرداخت یا روز تحویل)
    exchange_rate_value     NUMERIC(18,4) NOT NULL,  -- نرخ همون روز، snapshot شده از exchange_rates (برای حسابرسی، حتی اگه نرخ تاریخی بعداً اصلاح بشه)
    amount_irr              NUMERIC(18,2) NOT NULL   -- amount_currency * exchange_rate_value
);

-- مرحله ۱۶: پیگیری و دریافت وجه (بدون اقساط منظم)
CREATE TABLE invoice_collections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    due_date            DATE,
    total_amount        NUMERIC(18,4) NOT NULL,
    actual_receipt_date DATE,
    payment_document_file_url TEXT,  -- پیوست سند پرداخت
    payment_method      VARCHAR(20)
                            CHECK (payment_method IN ('cash', 'cheque', 'wire_transfer')),
    settlement_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (settlement_status IN ('settled', 'overdue', 'pending')),
    follow_up_notes     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- دامنه ۸: مکاتبات و بایگانی اسناد (Correspondence & Document Archive)
-- ============================================================

-- شمارنده مجزا برای تولید شماره نامه یکتا — جلوگیری از تداخل هم‌زمان (race condition)
-- ⚠️ کلید شمارنده بر اساس «شرکت صادرکننده/دریافت‌کننده» (our_entities) است، نه جهت نامه (ورودی/صادره)
-- هر سال برای هر شرکت از نو شروع می‌شه؛ سال بر اساس our_entities.calendar_type محاسبه می‌شه (شمسی برای ایران، میلادی برای خارجی)
CREATE TABLE letter_counters (
    year            INTEGER NOT NULL,       -- سال شمسی (شرکت ایرانی) یا میلادی (شرکت‌های خارجی) بسته به calendar_type همون شرکت
    our_entity_id   UUID NOT NULL REFERENCES our_entities(id),
    last_serial     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (year, our_entity_id)
);
-- تولید شماره بعدی باید در یک تراکنش اتمیک (SELECT ... FOR UPDATE سپس UPDATE) انجام بشه تا دو کاربر هم‌زمان یک شماره نگیرن

CREATE TABLE letters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_number       VARCHAR(50) UNIQUE,     -- فرمت: YYYY-ShortCode-Serial — مثلاً «1405-پ ت-0042» (ایران، شمسی) یا «2026-GT-0005» (شرکت خارجی، میلادی) — فقط بعد از ثبت رسمی (status >= registered) پر می‌شه
    type                VARCHAR(20) NOT NULL
                            CHECK (type IN ('incoming', 'outgoing', 'internal')),
    letter_date         DATE NOT NULL,
    subject             VARCHAR(500) NOT NULL,

    -- ⚠️ فرستنده و گیرنده باید از موجودیت‌های از پیش تعریف‌شده انتخاب بشن، نه متن آزاد
    -- هرکدوم می‌تونه یکی از شرکت‌های خودمون باشه، یا یک طرف تجاری بیرونی (به‌همراه رابط اختیاری آن)
    sender_our_entity_id    UUID REFERENCES our_entities(id),
    sender_partner_id       UUID REFERENCES business_partners(id),
    sender_contact_id       UUID REFERENCES partner_contacts(id),
    receiver_our_entity_id  UUID REFERENCES our_entities(id),
    receiver_partner_id     UUID REFERENCES business_partners(id),
    receiver_contact_id     UUID REFERENCES partner_contacts(id),
    -- شرکت گروه ما که این نامه تحت شماره‌گذاری آن ثبت می‌شه (پایه‌ی letter_counters) — معمولاً همون sender یا receiver our_entity
    issuing_entity_id       UUID NOT NULL REFERENCES our_entities(id),

    department          VARCHAR(100),   -- واحد مربوطه (فروش/بازرگانی/مالی/...)
    priority            VARCHAR(20) NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('normal', 'urgent', 'very_urgent')),
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'registered', 'sent', 'archived')),
    related_inquiry_id  UUID REFERENCES inquiries(id),      -- ارتباط اختیاری با یک استعلام/پرونده
    related_shipment_id UUID REFERENCES shipments(id),      -- ارتباط اختیاری با یک محموله
    description         TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- نکته کسب‌وکاری (در سطح اپلیکیشن، نه Constraint دیتابیس): دقیقاً یکی از (sender_our_entity_id, sender_partner_id)
-- و دقیقاً یکی از (receiver_our_entity_id, receiver_partner_id) باید پر باشه — یعنی فرستنده/گیرنده یا «ما»ییم یا یک طرف تجاری،
-- نه هر دو هم‌زمان و نه هیچ‌کدام. sender_contact_id/receiver_contact_id فقط وقتی طرف بیرونیه معنا داره (اختیاری، شخص مشخص در آن شرکت)

-- بایگانی اسناد — هر فایل می‌تونه به یک نامه وصل باشه یا مستقل (اسکن یک قرارداد بدون نامه رسمی)
CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    related_letter_id   UUID REFERENCES letters(id) ON DELETE SET NULL,
    file_name           VARCHAR(300) NOT NULL,
    file_type           VARCHAR(20) NOT NULL
                            CHECK (file_type IN ('pdf', 'image', 'excel', 'other')),
    file_url            TEXT NOT NULL,
    category            VARCHAR(30) NOT NULL DEFAULT 'other'
                            CHECK (category IN ('contract', 'invoice', 'shipping_doc', 'customs_doc', 'technical_file', 'other')),
    ocr_text            TEXT,   -- متن استخراج‌شده از OCR (در صورت فعال بودن) — برای جست‌وجوی پیشرفته
    uploaded_by         UUID NOT NULL REFERENCES users(id),
    upload_date         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_tags (
    document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag             VARCHAR(100) NOT NULL,
    PRIMARY KEY (document_id, tag)
);

-- گردش کار نامه (ارجاع به کارشناس، پاسخ/اقدام، تأیید مدیر، ثبت شماره رسمی، ارسال، بایگانی)
CREATE TABLE letter_workflow_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id           UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    action              VARCHAR(30) NOT NULL
                            CHECK (action IN ('registered', 'scanned', 'referred', 'responded', 'approved', 'sent', 'archived')),
    performed_by        UUID NOT NULL REFERENCES users(id),
    referred_to_user_id UUID REFERENCES users(id),  -- در صورتی که action='referred'
    note                TEXT,
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log — چه کسی نامه رو دید/ویرایش کرد (جدا از گردش کار، صرفاً ردیابی دسترسی)
CREATE TABLE letter_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_id       UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(20) NOT NULL CHECK (action IN ('viewed', 'edited')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فاز ۲۴ — بازطراحی مکاتبات جهت‌محور: مسئول پیگیری نامه دریافتی (جایگزین department برای این نوع)،
-- شماره نامه فرستنده، امضاکننده(های) نامه ارسالی، و بخش مبدأ/مقصد واقعی HR برای نامه داخلی
ALTER TABLE letters
    ADD COLUMN responsible_user_id          UUID REFERENCES users(id),
    ADD COLUMN sender_reference_number      VARCHAR(100),
    ADD COLUMN internal_from_department_id  UUID REFERENCES departments(id),
    ADD COLUMN internal_to_department_id    UUID REFERENCES departments(id);

-- امضاکننده(های) نامه ارسالی — چندبه‌چند، چون می‌تونه بیش از یک نفر امضا کنه
CREATE TABLE letter_signers (
    letter_id  UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (letter_id, user_id)
);

-- یادآور/مهلت پاسخ به نامه — این جدول دیگه استفاده نمی‌شه، جایگزینش reminders سراسریه (پایین‌تر)
-- CREATE TABLE letter_reminders ... [حذف شد، نگاه کنید به دامنه ۹]

-- اعلان ارجاع نامه — این جدول دیگه استفاده نمی‌شه، جایگزینش notifications سراسریه (پایین‌تر)
-- CREATE TABLE letter_notifications ... [حذف شد، نگاه کنید به دامنه ۹]

-- ============================================================
-- دامنه ۹: اعلان‌ها، یادآورها (TODO)، و پیام‌رسانی سراسری
-- ============================================================

-- ⚠️ اعلان‌ها سراسری‌ان (نه فقط برای نامه) و مثل SAP از داخل خود اعلان قابل اقدام‌ (تأیید/رد/...) هستن
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),   -- گیرنده اعلان
    type                VARCHAR(40) NOT NULL,   -- مثلاً 'mention', 'letter_referral', 'approval_request', 'rfq_overdue', 'reminder_due'
    title               VARCHAR(200) NOT NULL,
    message             TEXT,
    related_entity_type VARCHAR(30),   -- مثلاً 'letter', 'inquiry', 'rfq', 'selection'
    related_entity_id   UUID,
    actions             JSONB,   -- دکمه‌های قابل‌اقدام داخل خود اعلان، مثلاً [{"label":"تأیید","action":"approve"},{"label":"رد","action":"reject"}]
    is_read             BOOLEAN NOT NULL DEFAULT false,
    is_actioned         BOOLEAN NOT NULL DEFAULT false,
    actioned_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- یادآور/TODO شخصی — این جدول دیگه استفاده نمی‌شه، فاز ۱۶ (Migration 0008_activities)
-- جایگزینش کرد با activities (پایین‌تر) چون یک Entity عمومی‌تر برای هر نوع «کار» لازم بود،
-- نه فقط یادآور ساده. DROP TABLE reminders؛ CREATE TABLE activities.
-- CREATE TABLE reminders ... [حذف شد در فاز ۱۶، نگاه کنید به activities پایین‌تر]

-- ⚠️ فاز ۱۶ (Migration 0008_activities) — جایگزین reminders بالا؛ Entity عمومی «کار»
-- (تماس/ایمیل/جلسه/پیگیری/یادآور/تأیید/کار داخلی) با گردش وضعیت و Cron خودکار Overdue.
-- outcome_id/activity_outcome_templates (فاز ۱۷) و in_progress/waiting_reason (فاز ۳۱) پایین‌تر می‌آن.
CREATE TABLE activities (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type             VARCHAR(30) NOT NULL
                                  CHECK (activity_type IN ('call','email','meeting','follow_up','reminder','approval','internal_task','mention')),
    -- 'mention' از Migration 0036_activity_type_mention اضافه شد (توسعهٔ Business Action Hub)
    subject                   VARCHAR(300) NOT NULL,
    description                TEXT,
    related_entity_type       VARCHAR(30),   -- فعلاً فقط 'inquiry'؛ NULL یعنی فعالیت شخصی بدون اتصال
    related_entity_id         UUID,
    priority                   VARCHAR(20) NOT NULL DEFAULT 'normal'
                                  CHECK (priority IN ('low','normal','high','urgent')),
    status                     VARCHAR(20) NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','scheduled','waiting','overdue','completed','cancelled')),
    scheduled_at               TIMESTAMPTZ,
    due_at                      TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,
    assigned_to_user_id         UUID NOT NULL REFERENCES users(id),
    created_by_user_id          UUID NOT NULL REFERENCES users(id),
    outcome_note                 TEXT,   -- موقت — فاز ۱۷ با outcome_id ساختاریافته پایین‌تر تکمیلش کرد
    follow_up_of_activity_id     UUID REFERENCES activities(id),
    call_recording_url           TEXT,   -- VoIP-ready، فعلاً بدون استفاده
    ai_summary                    TEXT,   -- AI-ready، فعلاً بدون استفاده
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فاز ۱۷ — نتایج ساختاریافته + Auto Follow-up Engine: قالب‌های نتیجهٔ پیش‌فرض به‌ازای هر نوع
-- فعالیت + قالب سفارشی (فقط گروه مدیریت)؛ انتخاب نتیجه هنگام تکمیل فعالیت می‌تونه خودکار یک
-- فعالیت پیگیریِ زنجیره‌شده بسازه (نوع/سررسید طبق requires_follow_up/follow_up_offset_minutes)
CREATE TABLE activity_outcome_templates (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type            VARCHAR(30) NOT NULL,
    label                    VARCHAR(200) NOT NULL,
    is_default               BOOLEAN NOT NULL DEFAULT false,
    requires_follow_up       BOOLEAN NOT NULL DEFAULT false,
    follow_up_activity_type  VARCHAR(30),
    follow_up_offset_minutes INTEGER,
    created_by_user_id       UUID REFERENCES users(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_type, label)
);

ALTER TABLE activities ADD COLUMN outcome_id UUID REFERENCES activity_outcome_templates(id);

-- فاز ۳۱ — مرکز اقدامات (Action Center): طبق SPEC-PHASE-31 — الگوی «صندوق ورودی فدرال»
-- (این جدول بسط پیدا کرد، نه اینکه جدول جدید ساخته بشه). 'in_progress' به گردش وضعیت دستی
-- اضافه شد؛ waiting_reason توضیح «منتظر چی/کی؟» رو وقتی status='waiting' نگه می‌داره.
-- تبدیل کامل 'overdue' از وضعیت enum به Flag محاسبه‌شده عمداً به فاز بعد موکول شد.
ALTER TABLE activities DROP CONSTRAINT activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
    CHECK (status IN ('open','in_progress','scheduled','waiting','overdue','completed','cancelled'));
ALTER TABLE activities ADD COLUMN waiting_reason TEXT;

-- Migration 0035_task_core — گسترش activities به هستهٔ Work Management (Business Action Hub):
-- Watcher، Timeline (کامنت+لاگ ترکیبی، هم‌الگوی inquiry_discussions)، و effect ساختاریافته
-- روی نتایج به‌جای فقط requires_follow_up (boolean). جدول activities عمداً دست‌نخورده
-- می‌مونه — این دو جدول جدید متعلق به همون دامنهٔ activities هستن، نه یک موجودیت جدا.
ALTER TABLE activity_outcome_templates
    ADD COLUMN effect VARCHAR(20) NOT NULL DEFAULT 'close'
        CHECK (effect IN ('close', 'create_follow_up', 'keep_waiting'));
-- close=بستن، create_follow_up=پیگیری (پیش‌فرض همون Task با سررسید جدید، نه لزوماً Task
-- مستقل جدید)، keep_waiting=انتقال به وضعیت انتظار با یک دلیل — طبق طراحی UX تأییدشده

CREATE TABLE task_watchers (
    task_id           UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by_user_id  UUID NOT NULL REFERENCES users(id),
    added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

-- تاریخچهٔ کامل هر Task — کامنت آزاد کاربر + لاگ خودکار سیستم، دقیقاً هم‌الگوی inquiry_discussions
CREATE TABLE task_timeline_entries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    entry_type   VARCHAR(20) NOT NULL CHECK (entry_type IN ('comment', 'activity')),
    author_id    UUID NOT NULL REFERENCES users(id),
    entry_text   TEXT NOT NULL,
    action_kind  VARCHAR(30),   -- created | reassigned | outcome_recorded | watcher_added | ...
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_timeline_entries_task ON task_timeline_entries(task_id, created_at);

-- پیام‌رسانی و چت کلی (جدا از گفتگوی مخصوص هر استعلام) — با قابلیت ساخت گروه
CREATE TABLE chat_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_type VARCHAR(10) NOT NULL DEFAULT 'direct'
                        CHECK (conversation_type IN ('direct', 'group')),
    group_name      VARCHAR(150),   -- فقط برای conversation_type='group'
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_participants (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- فاز ۲۹ — رسید خواندن (Read Receipt): آخرین لحظه‌ای که این شرکت‌کننده مکالمه رو خونده
ALTER TABLE chat_participants ADD COLUMN last_read_at TIMESTAMPTZ;

CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    message_text    TEXT NOT NULL,
    file_url        TEXT,   -- پیوست اختیاری
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فاز ۳۰ — ویرایش/حذف پیام توسط خودِ فرستنده. حذف Soft Delete (مثل تلگرام): رکورد پاک نمی‌شه،
-- فقط deleted_at پر می‌شه و فرانت به‌جای متن واقعی «این پیام حذف شد» نشون می‌ده
ALTER TABLE chat_messages
    ADD COLUMN edited_at  TIMESTAMPTZ,
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- پیام اعلامی مدیر در بدو ورود (Broadcast) — فاز ۴۱-ج
-- ⚠️ بدون فن‌اوت رکورد Notification در لحظه ایجاد (پرهزینه برای هدف گروه/همه)؛
-- کوئری «پیام‌های در انتظار من» در لحظه بررسی می‌شه (نگاه کنید به erp-database-design.md)
-- ------------------------------------------------------------

-- Migration 0033_broadcast_messages (فاز ۴۱-ج)
CREATE TABLE broadcast_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url       TEXT,
    message         TEXT NOT NULL,
    target_type     VARCHAR(10) NOT NULL CHECK (target_type IN ('user', 'group', 'all')),
    target_user_id  UUID REFERENCES users(id),
    target_group_id UUID REFERENCES permission_groups(id),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_messages_active ON broadcast_messages(active);

-- ثبت این‌که کدوم کاربر کدوم پیام رو بسته — یک‌بار نمایش، دیگه هرگز تکرار نمی‌شه
CREATE TABLE broadcast_message_dismissals (
    broadcast_message_id UUID NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_message_id, user_id)
);

-- ============================================================
-- دامنه ۱۰: خزانه‌داری و برنامه‌ریزی مالی (Treasury & Financial Planning)
-- ⚠️ این دامنه غیر از حسابداری (Ledger/دفاتر) است — همون‌طور که در یادداشت
-- our_entities (دامنه ۱) اومد، حسابداری/دفتر کل یک ماژول جداست که در آینده
-- به our_entities وصل می‌شه. اینجا فقط برنامه‌ریزی، پیش‌بینی و کنترل نقدینگیه.
-- ============================================================

-- ------------------------------------------------------------
-- بودجه
-- ------------------------------------------------------------

-- دسته‌های بودجه‌ای — درختی، تا هم سرفصل کلی (مثلاً «هزینه‌های اداری») هم زیرسرفصل داشته باشیم
CREATE TABLE budget_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name       VARCHAR(200) NOT NULL,
    category_type       VARCHAR(10) NOT NULL
                        CHECK (category_type IN ('income', 'expense')),
    parent_category_id  UUID REFERENCES budget_categories(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive'))
);

-- سند بودجه — به تفکیک شرکت گروه (our_entity) و سال مالی
-- ⚠️ چون شرکت ایرانی تقویم شمسی و شرکت‌های خارجی میلادی دارن (نگاه کنید به our_entities.calendar_type)،
-- fiscal_year همیشه به‌صورت عدد ساده (۱۴۰۵ یا ۲۰۲۶) ذخیره می‌شه و تفسیرش در سطح اپلیکیشن بر مبنای همون calendar_type انجام می‌شه
CREATE TABLE budgets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_entity_id  UUID NOT NULL REFERENCES our_entities(id),
    fiscal_year    INTEGER NOT NULL,
    title          VARCHAR(200),
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'approved', 'closed')),
    approved_by    UUID REFERENCES users(id),
    approved_at    TIMESTAMPTZ,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (our_entity_id, fiscal_year)
);

-- ردیف‌های بودجه — تفکیک ماهانه اختیاریه (month=NULL یعنی سقف سالانه بدون تفکیک ماه)
CREATE TABLE budget_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id       UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES budget_categories(id),
    month           INTEGER CHECK (month BETWEEN 1 AND 12),
    currency_code   VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    planned_amount  NUMERIC(18,4) NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- پیش‌بینی جریان نقدی / مطالبات / پرداختنی‌ها
-- ⚠️ نکته معماری مهم: پیش‌بینی مطالبات (Receivable Forecast) و پرداختنی‌ها (Payable Forecast)
-- جدول جدا نمی‌خوان — این‌ها مستقیماً از customer_payments و supplier_payments موجود
-- (status='unpaid' + due_date) به‌صورت Query/گزارش ساخته می‌شن، چون داده از قبل در دامنه ۵ ثبت شده.
-- Cash Flow Forecast = تجمیع همین دو منبع + ردیف‌های دستی زیر (برای مواردی که هنوز
-- به یک سفارش/PO رسمی تبدیل نشدن، مثل یک معامله در حال مذاکره یا هزینه ثابت ماهانه پیش‌بینی‌شده)
-- ------------------------------------------------------------

CREATE TABLE cash_flow_manual_entries (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_entity_id        UUID NOT NULL REFERENCES our_entities(id),
    direction            VARCHAR(10) NOT NULL
                         CHECK (direction IN ('inflow', 'outflow')),
    category_id          UUID REFERENCES budget_categories(id),   -- اختیاری — می‌تونه به دسته بودجه وصل بشه برای مقایسه بودجه/واقعی
    description          VARCHAR(300) NOT NULL,
    expected_date        DATE NOT NULL,
    currency_code        VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    amount               NUMERIC(18,4) NOT NULL,
    confidence_level     VARCHAR(10) NOT NULL DEFAULT 'probable'
                         CHECK (confidence_level IN ('certain', 'probable', 'possible')),  -- برای وزن‌دهی در نمودار پیش‌بینی
    related_entity_type  VARCHAR(30),   -- در صورت وجود، لینک اختیاری به یک استعلام/سفارش در حال مذاکره
    related_entity_id    UUID,
    created_by           UUID REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- درخواست هزینه و درخواست پرداخت
-- ⚠️ تفاوت این دو: «درخواست هزینه» پیش از خرج‌کردن است (تأییدیه گرفتن قبل از تعهد مالی)؛
-- «درخواست پرداخت» برای اجرای واقعی یک پرداخت مشخصه (چه از یک expense_request تأییدشده،
-- چه از یک ردیف supplier_payments سررسیدشده، چه از حقوق/وام پرسنل) — یعنی می‌تونه منشأ متفاوت داشته باشه
-- ------------------------------------------------------------

CREATE TABLE expense_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number       VARCHAR(50) UNIQUE NOT NULL,
    our_entity_id        UUID NOT NULL REFERENCES our_entities(id),
    requested_by         UUID NOT NULL REFERENCES users(id),
    category_id          UUID REFERENCES budget_categories(id),
    description          VARCHAR(500) NOT NULL,
    currency_code        VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    amount               NUMERIC(18,4) NOT NULL,
    needed_by_date       DATE,
    attachment_file_url  TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    current_approver_id  UUID REFERENCES users(id),
    approved_at          TIMESTAMPTZ,
    rejection_reason     TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_requests (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number             VARCHAR(50) UNIQUE NOT NULL,
    our_entity_id              UUID NOT NULL REFERENCES our_entities(id),
    payee_partner_id           UUID REFERENCES business_partners(id),   -- اگه گیرنده یک طرف تجاری بیرونیه
    payee_employee_id          UUID,   -- اگه گیرنده پرسنله (FK به employees بعد از تعریف در دامنه ۱۱ با ALTER اضافه می‌شه)
    -- ⚠️ منشأ درخواست به‌صورت عمومی (نه FK مستقیم) چون می‌تونه از چند منبع مختلف بیاد:
    -- 'expense_request', 'supplier_payment', 'customer_refund', 'payroll', 'employee_loan', 'other'
    source_type                VARCHAR(30) NOT NULL,
    source_entity_id           UUID,
    currency_code              VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    amount                     NUMERIC(18,4) NOT NULL,
    due_date                   DATE,
    requested_by               UUID NOT NULL REFERENCES users(id),
    status                     VARCHAR(20) NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'scheduled', 'paid', 'rejected')),
    approved_by                UUID REFERENCES users(id),
    approved_at                TIMESTAMPTZ,
    paid_at                    TIMESTAMPTZ,
    payment_document_file_url  TEXT,   -- پیوست سند پرداخت نهایی، مشابه الگوی customer_payments/supplier_payments
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- تقویم مالی
-- ⚠️ این جدول از reminders (دامنه ۹) جداست، چون reminders برای TODO شخصیه ولی این
-- مخصوص رویدادهای مالی سررسیددار با دسته‌بندی و تکرار (سررسید اقساط وام، انقضای ضمانت‌نامه/LC، مهلت مالیاتی...)
-- ------------------------------------------------------------

CREATE TABLE financial_calendar_events (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_entity_id         UUID NOT NULL REFERENCES our_entities(id),
    title                 VARCHAR(300) NOT NULL,
    category              VARCHAR(30) NOT NULL
                          CHECK (category IN ('tax', 'customs', 'loan_installment', 'guarantee_expiry',
                          'lc_expiry', 'insurance', 'contract_renewal', 'other')),
    event_date            DATE NOT NULL,
    recurrence            VARCHAR(10) NOT NULL DEFAULT 'none'
                          CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'annual')),
    related_entity_type   VARCHAR(30),   -- مثلاً 'issued_guarantee', 'employee_loan'
    related_entity_id     UUID,
    reminder_days_before  INTEGER NOT NULL DEFAULT 7,
    status                VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                          CHECK (status IN ('upcoming', 'done', 'overdue')),
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- KPI مالی — پایه Financial Dashboard و Executive Dashboard
-- ⚠️ خود داشبوردها (مالی/اجرایی) جدول جدا نمی‌خوان — مثل الگوی دامنه ۹، فقط چند
-- دسترسی جدید به ماژول 'treasury' در permissions اضافه می‌شه (مثلاً treasury.view_financial_dashboard
-- در مقابل treasury.view_executive_dashboard) تا مشخص بشه کی چه سطحی از KPI ها رو می‌بینه.
-- KPI های سبک (نسبت نقدینگی لحظه‌ای و…) به‌صورت Live Query محاسبه می‌شن؛ KPI های سنگین‌تر
-- (روند ماهانه، مقایسه چند دوره) در financial_kpi_snapshots کش می‌شن.
-- ------------------------------------------------------------

CREATE TABLE financial_kpis (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_key           VARCHAR(100) UNIQUE NOT NULL,   -- مثلاً 'cash_position', 'dso', 'dpo', 'budget_variance'
    kpi_label         VARCHAR(300) NOT NULL,
    category          VARCHAR(50),   -- مثلاً 'liquidity', 'receivables', 'payables', 'budget'
    calculation_type  VARCHAR(10) NOT NULL DEFAULT 'live'
                      CHECK (calculation_type IN ('live', 'snapshot')),
    unit              VARCHAR(20),   -- درصد/روز/مبلغ
    target_value      NUMERIC(18,4),
    status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE financial_kpi_snapshots (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id         UUID NOT NULL REFERENCES financial_kpis(id) ON DELETE CASCADE,
    our_entity_id  UUID REFERENCES our_entities(id),   -- NULL یعنی سطح کل گروه (تجمیعی)
    period_date    DATE NOT NULL,
    actual_value   NUMERIC(18,4) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (kpi_id, our_entity_id, period_date)
);

-- ------------------------------------------------------------
-- دستیار هوش مصنوعی مالی
-- ⚠️ گفتگوی زبان‌طبیعی روی داده‌های مالی — جدا از chat_conversations (دامنه ۹) که برای
-- پیام‌رسانی بین کاربرانه، نه گفتگو با AI. query_context ذخیره می‌شه تا هم قابل Audit باشه
-- (چه داده‌ای به کاربر نشون داده شده) هم برای بهبود دقت پاسخ‌های بعدی قابل استفاده باشه.
-- ------------------------------------------------------------

CREATE TABLE ai_financial_assistant_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(300),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_financial_assistant_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES ai_financial_assistant_conversations(id) ON DELETE CASCADE,
    role             VARCHAR(10) NOT NULL
                     CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    query_context    JSONB,   -- جزئیات ساختاریافته: کدوم جدول‌ها/فیلترها برای پاسخ استفاده شدن (برای Audit)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- دامنه ۱۱: منابع انسانی (Human Resources)
-- ============================================================

-- ------------------------------------------------------------
-- ساختار سازمانی و پرونده پرسنل
-- ⚠️ employees از users کاملاً جداست: users فقط برای کسایی‌ه که وارد سیستم می‌شن
-- (کارشناسان، مدیران و...)، ولی نه همه پرسنل شرکت لزوماً حساب کاربری سیستم دارن
-- (مثلاً نیروی انبار/راننده). به همین دلیل employees اطلاعات هویتی خودش رو مستقل نگه
-- می‌داره و user_id فقط در صورتی پر می‌شه که اون فرد به سیستم هم دسترسی داشته باشه.
-- ------------------------------------------------------------

-- بخش‌های سازمانی — درختی، برای چارت سازمانی
CREATE TABLE departments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name       VARCHAR(200) NOT NULL,
    parent_department_id  UUID REFERENCES departments(id),
    our_entity_id         UUID NOT NULL REFERENCES our_entities(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID REFERENCES users(id),   -- در صورت وجود حساب کاربری سیستم؛ Nullable
    employee_number          VARCHAR(30) UNIQUE NOT NULL,
    full_name                VARCHAR(200) NOT NULL,
    national_id              VARCHAR(20),
    birth_date               DATE,
    gender                   VARCHAR(10) CHECK (gender IN ('male', 'female')),
    mobile                   VARCHAR(30),
    email                    VARCHAR(200),
    address                  TEXT,
    marital_status           VARCHAR(20) CHECK (marital_status IN ('single', 'married')),
    military_service_status  VARCHAR(30)   -- وضعیت خدمت نظام‌وظیفه — فقط برای پرسنل مرد ایرانی معنا داره
                             CHECK (military_service_status IN
                             ('completed', 'exempt', 'in_progress', 'not_applicable')),
    education_level          VARCHAR(30),
    profile_photo_url        TEXT,
    bank_account_number      VARCHAR(50),
    bank_name                VARCHAR(100),
    emergency_contact_name   VARCHAR(200),
    emergency_contact_phone  VARCHAR(30),
    department_id            UUID REFERENCES departments(id),
    position_title           VARCHAR(150),
    direct_manager_id        UUID REFERENCES employees(id),   -- خودارجاع — مبنای چارت سازمانی
    our_entity_id            UUID NOT NULL REFERENCES our_entities(id),   -- استخدام زیر کدوم شرکت گروه
    hire_date                DATE NOT NULL,
    termination_date         DATE,
    employment_status        VARCHAR(20) NOT NULL DEFAULT 'active'
                             CHECK (employment_status IN ('active', 'on_leave', 'terminated')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- سرپرست بخش — بعد از تعریف employees با ALTER اضافه می‌شه (همون الگوی selected_offer_id در دامنه ۲)
ALTER TABLE departments
    ADD COLUMN head_employee_id UUID REFERENCES employees(id);

-- تکمیل payment_requests دامنه ۱۰: حالا که employees تعریف شد، FK واقعی رو وصل می‌کنیم
ALTER TABLE payment_requests
    ADD CONSTRAINT fk_payment_requests_payee_employee
    FOREIGN KEY (payee_employee_id) REFERENCES employees(id);

CREATE INDEX idx_employees_full_name ON employees USING gin (full_name gin_trgm_ops);

-- چارت سازمانی: از employees.direct_manager_id + departments.parent_department_id
-- به‌صورت درختی محاسبه می‌شه — جدول جداگانه نیاز نداره

-- ------------------------------------------------------------
-- قرارداد
-- ------------------------------------------------------------

CREATE TABLE employee_contracts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    our_entity_id    UUID NOT NULL REFERENCES our_entities(id),
    contract_type    VARCHAR(20) NOT NULL
                     CHECK (contract_type IN ('permanent', 'fixed_term', 'project_based', 'probation')),
    position_title   VARCHAR(150),
    start_date       DATE NOT NULL,
    end_date         DATE,   -- NULL برای permanent
    base_salary      NUMERIC(18,4) NOT NULL,
    salary_currency  VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    work_location    VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'expired', 'terminated')),
    file_url         TEXT,
    signed_date      DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فاز ۴۲ — فرزندان با تاریخ تولد؛ جایگزین employee_payroll_profiles.children_count (که Deprecated
-- شد ولی حذف نشده) چون حق اولاد قانوناً فقط تا سقف سنی مشخص (Rule جداگانه CHILD_ALLOWANCE_MAX_AGE
-- در دامنه ۱۲، نه هاردکد) پرداخت می‌شه — بدون تاریخ تولد امکان محاسبه‌ی خودکار این سقف در هر دوره نبود
CREATE TABLE employee_children (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    full_name    VARCHAR(200),
    birth_date   DATE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employee_children_employee ON employee_children(employee_id);

-- ------------------------------------------------------------
-- حضور و غیاب
-- ------------------------------------------------------------

CREATE TABLE attendance_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date    DATE NOT NULL,
    check_in_time                TIMESTAMPTZ,
    check_out_time                TIMESTAMPTZ,
    status       VARCHAR(20) NOT NULL DEFAULT 'present'
                 CHECK (status IN ('present', 'absent', 'on_leave', 'holiday', 'mission')),
    source       VARCHAR(20) NOT NULL DEFAULT 'manual'
                 CHECK (source IN ('device', 'manual')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, work_date)
);

-- ------------------------------------------------------------
-- مرخصی
-- ------------------------------------------------------------

CREATE TABLE leave_types (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name                VARCHAR(100) NOT NULL,   -- مثلاً استحقاقی، استعلاجی، بدون حقوق، ازدواج، فوت بستگان، زایمان
    is_paid                  BOOLEAN NOT NULL DEFAULT true,
    annual_entitlement_days  NUMERIC(5,1)   -- سقف پیش‌فرض سالانه (روز) — می‌تونه NULL باشه (مثلاً بدون حقوق سقف نداره)
);

CREATE TABLE leave_balances (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id  UUID NOT NULL REFERENCES leave_types(id),
    year           INTEGER NOT NULL,
    entitled_days  NUMERIC(5,1) NOT NULL,
    used_days      NUMERIC(5,1) NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id        UUID NOT NULL REFERENCES leave_types(id),
    start_date           DATE NOT NULL,
    end_date             DATE NOT NULL,
    days_count           NUMERIC(5,1) NOT NULL,
    reason               TEXT,
    attachment_file_url  TEXT,   -- مثلاً گواهی پزشکی برای استعلاجی
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approver_id          UUID REFERENCES employees(id),
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- مأموریت
-- ------------------------------------------------------------

CREATE TABLE mission_requests (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    destination                 VARCHAR(200) NOT NULL,
    purpose                     TEXT,
    start_date                  DATE NOT NULL,
    end_date                    DATE NOT NULL,
    transportation_method       VARCHAR(50),
    estimated_cost              NUMERIC(18,4),
    currency_code               VARCHAR(3) REFERENCES currencies(currency_code),
    status                      VARCHAR(20) NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    approver_id                 UUID REFERENCES employees(id),
    approved_at                 TIMESTAMPTZ,
    -- ⚠️ بعد از تأیید مأموریت، در صورت نیاز به تنخواه/بازپرداخت هزینه سفر، یک رکورد در
    -- expense_requests (دامنه ۱۰) ساخته می‌شه و اینجا لینک می‌شه — نه تکرار منطق درخواست هزینه
    related_expense_request_id  UUID REFERENCES expense_requests(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- اضافه‌کاری
-- ------------------------------------------------------------

CREATE TABLE overtime_records (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date          DATE NOT NULL,
    hours              NUMERIC(5,2) NOT NULL,
    reason             TEXT,
    rate_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.4,   -- ضریب طبق قانون کار (مثلاً ۱.۴ روزهای عادی)
    calculated_amount  NUMERIC(18,4),
    currency_code      VARCHAR(3) REFERENCES currencies(currency_code),
    status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    approver_id        UUID REFERENCES employees(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- وام
-- ------------------------------------------------------------

CREATE TABLE employee_loans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    loan_amount           NUMERIC(18,4) NOT NULL,
    currency_code         VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    request_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    reason                TEXT,
    installment_count     INTEGER NOT NULL,
    monthly_installment   NUMERIC(18,4) NOT NULL,
    start_deduction_date  DATE,
    status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'active', 'settled', 'rejected')),
    approver_id           UUID REFERENCES employees(id),
    approved_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- اقساط وام — تفکیک‌شده تا در فیش حقوقی هرماه مشخص باشه کدوم قسط کسر شده
CREATE TABLE employee_loan_installments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id                 UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    installment_number      INTEGER NOT NULL,
    due_date                DATE NOT NULL,
    amount                  NUMERIC(18,4) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'deducted')),
    deducted_in_payslip_id  UUID,   -- بعد از تعریف payslips با ALTER وصل می‌شه
    UNIQUE (loan_id, installment_number)
);

-- ------------------------------------------------------------
-- مزایا و کسورات
-- ------------------------------------------------------------

CREATE TABLE benefit_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_name          VARCHAR(150) NOT NULL,   -- مثلاً حق مسکن، بن کارگری، حق اولاد، ایاب‌وذهاب، بیمه تکمیلی
    is_recurring_default  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE employee_benefits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    benefit_type_id  UUID NOT NULL REFERENCES benefit_types(id),
    amount           NUMERIC(18,4) NOT NULL,
    currency_code    VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    effective_from   DATE NOT NULL,
    effective_to     DATE,
    is_recurring     BOOLEAN NOT NULL DEFAULT true,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deduction_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_name        VARCHAR(150) NOT NULL,   -- مثلاً مالیات، بیمه سهم کارمند، جریمه انضباطی، قسط وام
    is_recurring_default  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE employee_deductions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    deduction_type_id  UUID NOT NULL REFERENCES deduction_types(id),
    amount             NUMERIC(18,4) NOT NULL,
    currency_code      VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    effective_from     DATE NOT NULL,
    effective_to       DATE,
    is_recurring       BOOLEAN NOT NULL DEFAULT true,
    related_loan_id    UUID REFERENCES employee_loans(id),   -- در صورتی که این کسر بابت یک وام باشه
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- درخواست‌ها — سرفصل عمومی
-- ⚠️ مرخصی/مأموریت/وام/اضافه‌کاری هرکدوم جدول تخصصی خودشونو دارن (بالا اومد) چون
-- فیلدهای ساختاریافته متفاوتی نیاز دارن. hr_requests فقط برای درخواست‌های عمومی‌تری‌ه
-- که جدول اختصاصی ندارن (گواهی اشتغال، پیش‌پرداخت حقوق، درخواست تجهیزات و...) —
-- در UI، صفحه «درخواست‌های من» این جدول رو با ۴ جدول تخصصی بالا ترکیب (UNION) می‌کنه
-- ------------------------------------------------------------

CREATE TABLE hr_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id          UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type         VARCHAR(30) NOT NULL
                         CHECK (request_type IN ('certificate', 'salary_advance', 'equipment', 'other')),
    description          TEXT NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    approver_id          UUID REFERENCES employees(id),
    related_entity_type  VARCHAR(30),
    related_entity_id    UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- فیش حقوقی
-- ------------------------------------------------------------

CREATE TABLE payroll_periods (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    our_entity_id  UUID NOT NULL REFERENCES our_entities(id),
    period_month   INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year    INTEGER NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'finalized', 'paid')),
    finalized_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (our_entity_id, period_month, period_year)
);

CREATE TABLE payslips (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id  UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL REFERENCES employees(id),
    base_salary        NUMERIC(18,4) NOT NULL,
    total_benefits     NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_overtime     NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_deductions   NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_amount         NUMERIC(18,4) NOT NULL,
    currency_code      VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    file_url           TEXT,   -- فایل PDF فیش
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'finalized', 'paid')),
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

-- ردیف‌های تفکیکی فیش — هم درآمد هم کسورات، برای شفافیت کامل (مشابه الگوی invoice_items)
CREATE TABLE payslip_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id   UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    item_type    VARCHAR(10) NOT NULL
                 CHECK (item_type IN ('earning', 'deduction')),
    category     VARCHAR(100) NOT NULL,   -- مثلاً 'حقوق پایه'، 'حق مسکن'، 'اضافه‌کاری'، 'بیمه'، 'قسط وام'
    description  VARCHAR(300),
    amount       NUMERIC(18,4) NOT NULL
);

-- حالا که payslips تعریف شد، اتصال قسط وام کسرشده به فیش مربوطه رو کامل می‌کنیم
ALTER TABLE employee_loan_installments
    ADD CONSTRAINT fk_loan_installments_payslip
    FOREIGN KEY (deducted_in_payslip_id) REFERENCES payslips(id);

-- ------------------------------------------------------------
-- ارزیابی عملکرد
-- ------------------------------------------------------------

CREATE TABLE performance_review_cycles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_name  VARCHAR(150) NOT NULL,   -- مثلاً «ارزیابی عملکرد نیمه اول ۱۴۰۵»
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE performance_reviews (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id           UUID NOT NULL REFERENCES performance_review_cycles(id) ON DELETE CASCADE,
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id        UUID NOT NULL REFERENCES employees(id),   -- معمولاً سرپرست مستقیم
    overall_score      NUMERIC(5,2),
    self_review_notes  TEXT,
    manager_notes      TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'acknowledged')),
    submitted_at       TIMESTAMPTZ,
    acknowledged_at    TIMESTAMPTZ,
    UNIQUE (cycle_id, employee_id)
);

-- امتیاز به تفکیک معیار (مثلاً کیفیت کار، انضباط، کار تیمی) با وزن مجزا برای هر معیار
CREATE TABLE performance_review_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    criterion_name  VARCHAR(150) NOT NULL,
    weight_percent  NUMERIC(5,2),
    score           NUMERIC(5,2),
    comments        TEXT
);

-- ------------------------------------------------------------
-- آموزش
-- ------------------------------------------------------------

CREATE TABLE training_courses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_title    VARCHAR(300) NOT NULL,
    provider        VARCHAR(200),
    category        VARCHAR(100),
    duration_hours  NUMERIC(6,1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE training_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id        UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
    start_date       DATE NOT NULL,
    end_date         DATE,
    location         VARCHAR(200),
    is_online        BOOLEAN NOT NULL DEFAULT false,
    instructor_name  VARCHAR(200),
    capacity         INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE training_enrollments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status                VARCHAR(20) NOT NULL DEFAULT 'enrolled'
                          CHECK (status IN ('enrolled', 'completed', 'no_show')),
    score                 NUMERIC(5,2),
    certificate_file_url  TEXT,
    completed_at          TIMESTAMPTZ,
    UNIQUE (session_id, employee_id)
);

-- ============================================================
-- دامنه ۱۲: موتور حقوق و دستمزد قانون‌محور (Payroll Engine) — فاز ۴۱
-- ⚠️ کاملاً افزودنی — هیچ جدول/ستون موجودی تغییر یا حذف نشد. جداول قدیمی
-- payroll_periods/payslips/payslip_items (دامنه ۱۱) دست‌نخورده باقی موندن؛ فقط در Prisma
-- به LegacyPayrollPeriod/LegacyPayslip/LegacyPayslipItem تغییر نام دادن (بدون اثر روی DB) —
-- نگاه کنید به یادداشت «جایگزینی نرم» در erp-database-design.md دامنه ۱۲.
-- ============================================================

-- سال حقوقی — واحد سطح‌بالای نسخه‌بندی قوانین و دوره‌ها
CREATE TABLE payroll_years (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year_number  INTEGER NOT NULL UNIQUE,
    calendar_type VARCHAR(10) NOT NULL DEFAULT 'jalali'
                    CHECK (calendar_type IN ('jalali', 'gregorian')),
    status       VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- نسخه‌ی قانون — قلب معماری «بدون هاردکد»: هر تغییر سالانه یعنی یک نسخه‌ی جدید، نه تغییر کد
CREATE TABLE payroll_rule_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_year_id UUID NOT NULL REFERENCES payroll_years(id),
    version_number  INTEGER NOT NULL,
    title           VARCHAR(200) NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'superseded')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_year_id, version_number)
);

-- تک‌تک قوانین عددی/درصدی/بولی این نسخه (نرخ بیمه، سقف، معافیت مالیاتی، ...) — Rule Engine فقط این جدول رو می‌خونه
CREATE TABLE payroll_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    title           VARCHAR(300) NOT NULL,
    value_type      VARCHAR(20) NOT NULL
                        CHECK (value_type IN ('number', 'percent', 'boolean')),
    value           NUMERIC(18,4) NOT NULL,
    effective_date  DATE NOT NULL,
    expire_date     DATE,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_version_id, code)
);

-- پله‌های مالیات پلکانی — ذاتاً چندردیفی، در قالب payroll_rules تک‌مقداره جا نمی‌شود
CREATE TABLE payroll_tax_brackets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    bracket_order   INTEGER NOT NULL,
    from_amount     NUMERIC(18,4) NOT NULL,
    to_amount       NUMERIC(18,4),   -- NULL = آخرین پله، بدون سقف
    rate_percent    NUMERIC(5,2) NOT NULL,
    UNIQUE (rule_version_id, bracket_order)
);

-- فرمول‌های متنی (DSL بدون eval) — هر جزء حقوق به یکی از این‌ها وصل می‌شه
CREATE TABLE payroll_formulas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id) ON DELETE CASCADE,
    code            VARCHAR(100) NOT NULL,
    expression      TEXT NOT NULL,   -- مثلاً "PERCENT(BASE, HOUSE_RATE)" یا "IF(CHILDREN_COUNT>0, ...)"
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_version_id, code)
);

-- کاتالوگ سراسری اجزای حقوق (BASE/HOUSE/OVERTIME/LOAN/...) — formula_id به یک فرمول از یک
-- نسخه‌ی مشخص وصله؛ برای سال بعد، بازپیوند formula_id تغییر می‌کنه نه کد این جدول
CREATE TABLE payroll_components (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(50) NOT NULL UNIQUE,
    title          VARCHAR(200) NOT NULL,
    component_type VARCHAR(10) NOT NULL
                        CHECK (component_type IN ('earning', 'deduction')),
    is_insurable   BOOLEAN NOT NULL DEFAULT false,
    is_taxable     BOOLEAN NOT NULL DEFAULT false,
    calc_order     INTEGER NOT NULL DEFAULT 0,   -- راهنمای نمایش؛ ترتیب واقعی محاسبه از Dependency Engine میاد
    formula_id     UUID REFERENCES payroll_formulas(id),
    status         VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- عمداً باریک نگه داشته شده — حقوق پایه/ارز از employee_contracts، تأهل از employees خونده می‌شه (بدون تکرار داده)
CREATE TABLE employee_payroll_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id             UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
    seniority_base_date     DATE,   -- پیش‌فرض = hire_date؛ فقط برای override دستی پر می‌شه
    children_count          INTEGER NOT NULL DEFAULT 0,   -- ⚠️ Deprecated فاز ۴۲ — جایگزین شد با employee_children (تاریخ تولد)؛ ستون برای Rollback مانده، دیگر خوانده نمی‌شه
    insurance_number        VARCHAR(50),
    cost_center_dept_id     UUID REFERENCES departments(id),
    default_rule_version_id UUID REFERENCES payroll_rule_versions(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ⚠️ نام‌گذاری متفاوت از جدول قدیمی payroll_periods (دامنه ۱۱، اکنون LegacyPayrollPeriod در
-- Prisma) — هر دوره برای همیشه به یک rule_version_id ثابت می‌مونه تا بازمحاسبه‌ی تاریخی دقیق بمونه
CREATE TABLE payroll_periods_v2 (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_year_id UUID NOT NULL REFERENCES payroll_years(id),
    period_code     VARCHAR(10) NOT NULL UNIQUE,   -- مثلاً "1406-01"
    month_number    INTEGER NOT NULL,
    rule_version_id UUID NOT NULL REFERENCES payroll_rule_versions(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot تجمیعی خودکار از attendance_records/leave_requests/overtime_records/mission_requests
-- (تصمیم تأییدشده §00-ب — بدون جدول ورودی دستی موازی)؛ با قابلیت اصلاح دستی برای موارد استثنا (source='manual')
CREATE TABLE payroll_work_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id   UUID NOT NULL REFERENCES payroll_periods_v2(id) ON DELETE CASCADE,
    employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    worked_days         NUMERIC(5,2) NOT NULL DEFAULT 0,
    overtime_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    night_hours         NUMERIC(6,2) NOT NULL DEFAULT 0,
    friday_hours        NUMERIC(6,2) NOT NULL DEFAULT 0,
    holiday_hours       NUMERIC(6,2) NOT NULL DEFAULT 0,
    mission_days        NUMERIC(5,2) NOT NULL DEFAULT 0,
    leave_days          NUMERIC(5,2) NOT NULL DEFAULT 0,
    absence_days        NUMERIC(5,2) NOT NULL DEFAULT 0,
    lateness_minutes    INTEGER NOT NULL DEFAULT 0,
    early_leave_minutes INTEGER NOT NULL DEFAULT 0,
    required_hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    worked_hours        NUMERIC(6,2) NOT NULL DEFAULT 0,
    source              VARCHAR(20) NOT NULL DEFAULT 'auto_aggregated'
                            CHECK (source IN ('auto_aggregated', 'manual')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

-- نتیجه‌ی محاسبه‌ی حقوق هر کارمند در هر دوره — گردش وضعیت Draft→Calculated→Reviewed→Approved→Posted→Locked
CREATE TABLE payroll_results (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_period_id         UUID NOT NULL REFERENCES payroll_periods_v2(id),
    employee_id               UUID NOT NULL REFERENCES employees(id),
    status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'calculated', 'reviewed', 'approved', 'posted', 'locked')),
    gross_earnings            NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_deductions          NUMERIC(18,4) NOT NULL DEFAULT 0,
    insurance_employee_share  NUMERIC(18,4) NOT NULL DEFAULT 0,
    insurance_employer_share  NUMERIC(18,4) NOT NULL DEFAULT 0,
    unemployment_insurance    NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_amount                NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_salary                NUMERIC(18,4) NOT NULL DEFAULT 0,
    employer_cost             NUMERIC(18,4) NOT NULL DEFAULT 0,
    calculated_at             TIMESTAMPTZ,
    calculated_by             UUID REFERENCES users(id),
    reviewed_at               TIMESTAMPTZ,
    reviewed_by               UUID REFERENCES users(id),
    approved_at               TIMESTAMPTZ,
    approved_by               UUID REFERENCES users(id),
    posted_at                 TIMESTAMPTZ,
    posted_by                 UUID REFERENCES users(id),
    locked_at                 TIMESTAMPTZ,
    locked_by                 UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

-- ⚠️ خط دفاعی دوم (علاوه بر گارد سطح اپلیکیشن) — پس از status='locked'، هیچ UPDATE/DELETE
-- مستقیمی (حتی از psql) روی این جدول ممکن نیست. تأییدشده زنده در فاز ۴۱.
CREATE OR REPLACE FUNCTION prevent_locked_payroll_result_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'locked' THEN
        RAISE EXCEPTION 'payroll_results: رکورد قفل‌شده (locked) قابل تغییر یا حذف نیست (id=%)', OLD.id;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_payroll_result_mutation
    BEFORE UPDATE OR DELETE ON payroll_results
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_payroll_result_mutation();

-- هر ردیف یک Snapshot است (component_code + formula_snapshot) — حتی اگه بعداً عنوان Component
-- یا متن فرمول عوض بشه، تاریخچه‌ی این نتیجه دست‌نخورده می‌مونه. کدهای INSURANCE/TAX اینجا نمی‌آن
-- (مقدارشون روی ستون‌های اختصاصی payroll_results ذخیره می‌شه، چون Insurance/Tax Engine مستقل حسابشون می‌کنن)
CREATE TABLE payroll_result_items (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_result_id  UUID NOT NULL REFERENCES payroll_results(id) ON DELETE CASCADE,
    component_id       UUID NOT NULL REFERENCES payroll_components(id),
    component_code     VARCHAR(50) NOT NULL,
    amount             NUMERIC(18,4) NOT NULL,
    calc_order         INTEGER NOT NULL,
    formula_snapshot   TEXT
);

-- ثبت هر تغییر (چه کسی/کِی/چه چیزی) روی موجودیت‌های حقوق — مستقل از منطق محاسباتی
CREATE TABLE payroll_audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     UUID NOT NULL,
    action        VARCHAR(20) NOT NULL
                      CHECK (action IN ('created', 'updated', 'deleted', 'status_changed')),
    field_name    VARCHAR(100),
    old_value     TEXT,
    new_value     TEXT,
    performed_by  UUID NOT NULL REFERENCES users(id),
    performed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_audit_log_entity ON payroll_audit_log(entity_type, entity_id);
