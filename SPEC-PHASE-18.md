# SPEC — فاز ۱۸: منابع انسانی (HR) — زیرفاز A: ساختار سازمانی + پروندهٔ پرسنل

> اولین فاز از دو ماژول جدیدی که شما درخواست کردید (دامنه ۱۰ خزانه‌داری + دامنه ۱۱ منابع انسانی، طبق `erp-schema.sql`/`erp-database-design.md` به‌روزشده).
> ترتیب توافق‌شده: **منابع انسانی (۴ زیرفاز) → خزانه‌داری (۲ زیرفاز) → تکمیل فاز ۱۸ سابق مرکز فعالیت‌ها (Escalation و بقیه، که به فاز بعدی موکول شد)**.
> این سند فقط زیرفاز A از HR رو پوشش می‌ده: `departments` + `employees` + `employee_contracts`.
> بدون Mockup بصری — دامنهٔ HR در `mockups/` نمونه‌ای نداره؛ از الگوهای موجود (`PartnersPage`, `UsersPage`) پیروی می‌شه.

## زیرفازهای بعدی HR (برای اطلاع، بعد از تأیید این سند پیش می‌ریم)

- **زیرفاز B**: حضور/غیاب + مرخصی + مأموریت + اضافه‌کاری
- **زیرفاز C**: وام + مزایا/کسورات + درخواست‌های عمومی (`hr_requests`)
- **زیرفاز D**: فیش حقوقی + ارزیابی عملکرد + آموزش

## هدف زیرفاز A

مدیریت ساختار سازمانی (بخش‌های درختی، به‌تفکیک شرکت گروه) + پروندهٔ کامل پرسنل (اطلاعات هویتی، استخدامی، مدیر مستقیم، بخش) + قرارداد استخدامی هر پرسنل.

## ⚠️ تصمیمات طراحی

1. **`employees` کاملاً جدا از `users`** (طبق طراحی schema) — این فاز فقط CRUD پروندهٔ پرسنلیه؛ اتصال اختیاری به یک حساب کاربری سیستمی (`employees.user_id`) از طریق انتخاب از لیست کاربران موجود (`GET /users`) ممکنه، ولی نه الزامی — پرسنل بدون حساب سیستمی (انباردار، راننده، نگهبان) هم پرونده کامل دارن.
2. **بدون ماژول دسترسی جدید در گروه‌های پیش‌فرض** — یک ماژول `hr` با کلیدهای `hr.view` و `hr.manage` به کاتالوگ دسترسی اضافه می‌شه؛ طبق الگوی «مدیریت = همهٔ کلیدها»، این خودکار در اختیار گروه مدیریته. به فروش/بازرگانی/مالی چیزی داده نمی‌شه چون HR کارکرد جداییه (اگه بعداً نیاز شد، مدیر می‌تونه از UI موجود گروه‌های سفارشی بسازه).
3. **شمارهٔ پرسنلی (`employee_number`) دستیه، نه خودکار** — برخلاف `internal_number` استعلام یا شمارهٔ نامه، schema هیچ جدول شمارندهٔ اتمیکی برای پرسنل تعریف نکرده؛ این یعنی شرکت‌ها معمولاً شمارهٔ پرسنلی خودشون رو از سیستم حقوق‌ودستمزد قبلی دارن. فرم فقط یکتا بودنش رو چک می‌کنه (مثل `item_catalog.item_code` قبل از سیستم خودکار).
4. **هشدار شباهت نام** — schema ایندکس `pg_trgm` روی `employees.full_name` گذاشته (دقیقاً مثل `business_partners.company_name`)؛ یعنی هنگام ثبت پرسنل جدید، هشدار نرم شباهت‌نام پیاده می‌شه — الگوی از پیش تثبیت‌شده در `BusinessPartnersService`/`ItemCatalogService`.
5. **چارت سازمانی به‌صورت نمودار تعاملی، خارج از اسکوپ این زیرفاز** — schema صراحتاً می‌گه چارت از `direct_manager_id` + `parent_department_id` به‌صورت درختی «محاسبه» می‌شه، نه یک UI مجزا. این زیرفاز فقط لیست بخش‌ها رو با تورفتگی (indent) بر اساس `parent_department_id` نشون می‌ده و در فرم پرسنل، Select «مدیر مستقیم» + «بخش» قرار می‌ده — یک نمودار درختی تصویری کامل (drag&drop) می‌تونه در آینده اضافه بشه.
6. **`departments.head_employee_id`**: چون در schema با `ALTER TABLE` بعد از `employees` اضافه شده (وابستگی رفت‌وبرگشتی)، در سطح UI هم به همین ترتیبه — فیلد «سرپرست بخش» در فرم ویرایش بخش (نه فرم ایجاد اولیه) ظاهر می‌شه و فقط از بین پرسنل همون بخش قابل انتخابه.
7. **`our_entity_id` الزامیه** روی هر دو جدول `departments` و `employees` (دقیقاً همون الگوی RFQ/PO/نامه‌ها) — از `GET /our-entities` موجود استفاده می‌شه.
8. **آپلود عکس پرسنلی**: از `FilesModule`/`AuthImage` موجود استفاده می‌شه — دقیقاً الگوی `profile_photo_url` کاربران (فاز ۱۵).

## مدل داده

Migration جدید: `0010_hr_org_structure` — بدون تغییر/حذف چیزی از migration های قبلی.

```sql
CREATE TABLE departments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name       VARCHAR(200) NOT NULL,
    parent_department_id  UUID REFERENCES departments(id),
    our_entity_id         UUID NOT NULL REFERENCES our_entities(id),
    status                VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employees (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID REFERENCES users(id),
    employee_number          VARCHAR(30) UNIQUE NOT NULL,
    full_name                VARCHAR(200) NOT NULL,
    national_id              VARCHAR(20),
    birth_date               DATE,
    gender                   VARCHAR(10) CHECK (gender IN ('male', 'female')),
    mobile                   VARCHAR(30),
    email                    VARCHAR(200),
    address                  TEXT,
    marital_status           VARCHAR(20) CHECK (marital_status IN ('single', 'married')),
    military_service_status  VARCHAR(30) CHECK (military_service_status IN ('completed', 'exempt', 'in_progress', 'not_applicable')),
    education_level          VARCHAR(30),
    profile_photo_url        TEXT,
    bank_account_number      VARCHAR(50),
    bank_name                VARCHAR(100),
    emergency_contact_name   VARCHAR(200),
    emergency_contact_phone  VARCHAR(30),
    department_id            UUID REFERENCES departments(id),
    position_title           VARCHAR(150),
    direct_manager_id        UUID REFERENCES employees(id),
    our_entity_id            UUID NOT NULL REFERENCES our_entities(id),
    hire_date                DATE NOT NULL,
    termination_date         DATE,
    employment_status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'terminated')),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments ADD COLUMN head_employee_id UUID REFERENCES employees(id);
CREATE INDEX idx_employees_full_name ON employees USING gin (full_name gin_trgm_ops);

CREATE TABLE employee_contracts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    our_entity_id    UUID NOT NULL REFERENCES our_entities(id),
    contract_type    VARCHAR(20) NOT NULL CHECK (contract_type IN ('permanent', 'fixed_term', 'project_based', 'probation')),
    position_title   VARCHAR(150),
    start_date       DATE NOT NULL,
    end_date         DATE,
    base_salary      NUMERIC(18,4) NOT NULL,
    salary_currency  VARCHAR(3) NOT NULL REFERENCES currencies(currency_code),
    work_location    VARCHAR(200),
    status           VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
    file_url         TEXT,
    signed_date      DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## بک‌اند (`HrModule` جدید)

| Endpoint | توضیح |
|---|---|
| `GET /departments` | لیست بخش‌ها (با `parent_department_id` برای ساخت درخت در فرانت) |
| `POST /departments` | ایجاد بخش |
| `PATCH /departments/:id` | ویرایش (شامل `head_employee_id`) |
| `GET /employees` | لیست پرسنل، فیلتر `q`/`departmentId`/`status` |
| `GET /employees/similar?name=` | هشدار شباهت نام (الگوی `pg_trgm` موجود) |
| `GET /employees/:id` | جزئیات + قراردادها |
| `POST /employees` | ایجاد |
| `PATCH /employees/:id` | ویرایش |
| `POST /employees/:id/contracts` | افزودن قرارداد جدید |
| `PATCH /employee-contracts/:id` | ویرایش قرارداد |

دسترسی: `hr.view` برای مشاهده، `hr.manage` برای ایجاد/ویرایش — کلید جدید در `permission-catalog.ts`، فقط به «مدیریت» به‌صورت پیش‌فرض داده می‌شه.

## فرانت‌اند

- آیتم منوی جدید «منابع انسانی» در Sidebar (`requiredPermission: 'hr.view'`)
- صفحهٔ `/hr` با دو تب: «پرسنل» (لیست + جزئیات/ویرایش + قراردادها) و «بخش‌ها» (لیست تودرتو + فرم ایجاد/ویرایش)
- الگوی view/edit-inline و هشدار شباهت، دقیقاً مطابق `PartnersPage.tsx`

## خارج از اسکوپ این زیرفاز

- حضور/غیاب، مرخصی، مأموریت، اضافه‌کاری (زیرفاز B)
- وام، مزایا/کسورات، درخواست عمومی (زیرفاز C)
- فیش حقوقی، ارزیابی عملکرد، آموزش (زیرفاز D)
- نمودار تصویری تعاملی چارت سازمانی

## تست‌ها

- **Jest**: هشدار شباهت نام؛ رد ایجاد پرسنل با شمارهٔ تکراری؛ `head_employee_id` فقط از پرسنل همون بخش قابل انتخابه (اعتبارسنجی سطح اپلیکیشن)
- **E2E زنده**: ایجاد بخش → ایجاد پرسنل زیر اون بخش با مدیر مستقیم → افزودن قرارداد → تنظیم سرپرست بخش

## Definition of Done

- [ ] Migration `0010_hr_org_structure` + مدل‌های Prisma (`Department`, `Employee`, `EmployeeContract`) + `generate`
- [ ] کلیدهای `hr.view`/`hr.manage` در permission-catalog + seed
- [ ] بک‌اند: `HrModule` کامل
- [ ] وب: `/hr` با تب‌های پرسنل/بخش‌ها + آیتم Sidebar
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README
