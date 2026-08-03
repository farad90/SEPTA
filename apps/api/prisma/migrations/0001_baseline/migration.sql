-- ============================================================
-- ERP پولاد تجهیز آپادانا — اسکریپت دیتابیس PostgreSQL
-- دامنه ۱: پایه/پشتیبان (BusinessPartner, User/Role, ItemCatalog, Currency)
-- ============================================================


CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- برای gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- برای جستجوی متنی و gin_trgm_ops
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

-- کدام بسته‌ها (از چند PO/پرونده مختلف) در این محموله قرار گرفتن — واحد دقیق‌تر از PO
CREATE TABLE shipment_packages (
    shipment_id                 UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    package_id                  UUID NOT NULL REFERENCES packages(id),
    PRIMARY KEY (shipment_id, package_id)
);
-- نکته: «کدام PO ها در این محموله هستند» با JOIN از طریق packages.po_id به‌دست می‌آد؛
-- نیازی به جدول جدای shipment_pos نیست چون packages واحد دقیق‌تریه

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

-- یادآور/TODO شخصی — خود کاربر برای خودش می‌سازه، یا مدیرش براش می‌نویسه
CREATE TABLE reminders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       UUID NOT NULL REFERENCES users(id),   -- برای چه کسیه
    created_by_user_id  UUID NOT NULL REFERENCES users(id),   -- خود شخص یا مدیرش
    title               VARCHAR(300) NOT NULL,
    due_at              TIMESTAMPTZ NOT NULL,
    note                TEXT,
    related_entity_type VARCHAR(30),   -- ارتباط اختیاری با یک استعلام/نامه/...
    related_entity_id   UUID,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'done')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    message_text    TEXT NOT NULL,
    file_url        TEXT,   -- پیوست اختیاری
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
