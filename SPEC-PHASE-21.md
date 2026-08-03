# SPEC — فاز ۲۱: منابع انسانی، زیرفاز D (نهایی) — فیش حقوقی + ارزیابی عملکرد

> آخرین زیرفاز منابع انسانی (بعد از فاز ۱۸=ساختار سازمانی، ۱۹=حضور/مرخصی/مأموریت/اضافه‌کاری، ۲۰=وام/مزایا/کسورات/درخواست عمومی).
> ماژول «آموزش» (`training_courses`/`training_sessions`/`training_enrollments`) طبق تصمیم صریح از این زیرفاز **حذف** شد — دامنه ۱۱ رسماً بدون این بخش تکمیل می‌شه؛ اگه بعداً لازم شد یه زیرفاز جدا می‌گیره.

## هدف

۲ زیرماژول:
1. **فیش حقوقی** (`payroll_periods`, `payslips`, `payslip_items`) — تجمیع خودکار از داده‌های موجود در دامنه (قرارداد، مزایا، اضافه‌کاری، کسورات، اقساط وام)
2. **ارزیابی عملکرد** (`performance_review_cycles`, `performance_reviews`, `performance_review_items`) — خودارزیابی پرسنل + ارزیابی توسط ارزیاب تعیین‌شده HR + تأیید نهایی پرسنل

## تصمیمات طراحی (بر اساس پاسخ‌های تأییدشده)

### فیش حقوقی

1. **تولید خودکار با یک دکمه، نه فرم دستی** — HR یک `payroll_periods` (شرکت گروه + ماه + سال) می‌سازه، بعد برای هر پرسنل (یا با «تولید همه») دکمه «تولید فیش» می‌زنه. سرویس این منابع رو خودکار جمع می‌کنه و ردیف‌های `payslip_items` می‌سازه:
   - **حقوق پایه** (`item_type='earning'`, `category='حقوق پایه'`): از جدیدترین `employee_contracts` با `status='active'` همون پرسنل که بازه‌ش دوره رو پوشش می‌ده
   - هر `employee_benefits` فعال در بازه دوره (`effective_from`/`effective_to` تلاقی داره) → یک ردیف `earning` جدا به‌ازای هر مزایا
   - `overtime_records` با `status='approved'` و `work_date` داخل دوره و `calculated_amount` غیرخالی → **یک ردیف تجمیعی** `earning` با `category='اضافه‌کاری'` (مجموع)
   - هر `employee_deductions` فعال در بازه دوره → یک ردیف `deduction` جدا به‌ازای هر کسر
   - هر `employee_loan_installments` با `status='pending'` و `due_date` داخل دوره از وام‌های همون پرسنل → یک ردیف `deduction` با `category='قسط وام'`؛ **هم‌زمان اون قسط `status='deducted'` می‌شه و `deducted_in_payslip_id` به همین فیش وصل می‌شه** — این دقیقاً همون اتصالی‌ست که در فاز ۱۹ (`mission_requests.related_expense_request_id`) و فاز ۲۰ (خود همین ستون) عمداً خالی نگه داشته شده بود؛ الان با ساخته‌شدن `payslips` تکمیل می‌شه.
   - `payslips.base_salary`/`total_benefits`/`total_overtime`/`total_deductions` از جمع ردیف‌های متناظر پر می‌شن؛ `net_amount = base_salary + total_benefits + total_overtime - total_deductions`
   - `payslips.currency_code` = ارز همون قرارداد پایه؛ **محدودیت شناخته‌شده**: اگه یک مزایا/کسر/قسط وام ارز متفاوتی داشته باشه، این فاز تبدیل ارز انجام نمی‌ده — فقط عدد خام رو با همون واحد قرارداد جمع می‌زنه (مثل بقیه سوالات باز پروژه، مستندسازی می‌شه نه حل)
2. **تولید مجدد فقط روی فیش `draft` مجازه** — اگه فیشی از قبل برای اون پرسنل/دوره هست و هنوز `draft`ه، تولید مجدد اول ردیف‌های قبلی رو پاک می‌کنه و اقساط وامی که بهش وصل بودن رو به `pending`/`deducted_in_payslip_id=NULL` برمی‌گردونه، بعد از نو می‌سازه (Idempotent). اگه فیش `finalized`/`paid` باشه، تولید مجدد مسدوده.
3. **نهایی‌سازی دوره** — HR روی `payroll_periods` دکمه «نهایی‌سازی» می‌زنه: `status→finalized`, `finalized_at` پر می‌شه، و همه فیش‌های اون دوره هم `status→finalized` می‌شن (قفل، دیگه تولید مجدد نمی‌شن). بعداً دکمه «ثبت پرداخت» دوره رو `paid` می‌کنه و فیش‌ها هم `paid` می‌شن.
4. **خودسرویس پرسنل فقط مشاهده** — `GET /payslips/mine` فیش‌های **فقط `finalized`/`paid`** خودم رو با ریز اقلام نشون می‌ده (فیش `draft` چون هنوز نهایی نشده به پرسنل نمایش داده نمی‌شه). هیچ Endpoint نوشتنی خودسرویس برای فیش حقوقی وجود نداره.

### ارزیابی عملکرد

5. **ارزیاب (`reviewer_id`) رو HR دستی تعیین می‌کنه** — نه لزوماً سرپرست مستقیم لحظه بررسی (طبق طراحی اصلی `erp-database-design.md`). موقع ساخت یک `performance_review`، HR از لیست پرسنل، هم پرسنل مورد ارزیابی هم ارزیاب رو انتخاب می‌کنه (پیش‌فرض UI: `direct_manager_id` فعلی پرسنل به‌عنوان پیشنهاد اولیه، ولی قابل تغییر).
6. **معیارها موقع ساخت تعریف می‌شن** — HR هم‌زمان با ساخت `performance_review`، فهرست معیارها (`performance_review_items`: `criterion_name` + `weight_percent`) رو می‌سازه؛ `score`/`comments` هر معیار بعداً توسط ارزیاب پر می‌شه.
7. **گردش وضعیت سه‌مرحله‌ای، دو خودسرویس متفاوت** —
   - `draft`: پرسنل مورد ارزیابی (خودسرویس، بر مبنای `employeeId === خودم`) می‌تونه `self_review_notes` رو بنویسه/ویرایش کنه.
   - ارزیاب (خودسرویس، بر مبنای `reviewerId === خودم` — **نه** رابطه سرپرست مستقیم، چون ارزیاب دستی تعیین می‌شه) نمره هر معیار + `comments` + `overall_score` + `manager_notes` رو پر می‌کنه و «ثبت نهایی ارزیابی» می‌زنه → `status→submitted`, `submitted_at` پر می‌شه.
   - پرسنل مورد ارزیابی بعد از `submitted` نتیجه رو می‌بینه و «تأیید مشاهده» می‌زنه → `status→acknowledged`, `acknowledged_at` پر می‌شه.
   - HR (`hr.manage`) روی همه این مراحل دسترسی override داره (می‌تونه هرجای گردش کار دستی ویرایش/تعیین وضعیت کنه)، برای مواردی مثل اصلاح اشتباه تایپی بعد از ثبت.
8. **بدون دسترسی RBAC جدید برای خودسرویس** — هم‌الگوی کل فازهای ۱۹/۲۰: خودسرویس (خودارزیابی، ثبت نمره توسط ارزیاب، تأیید مشاهده) بر مبنای تطبیق `employeeId`/`reviewerId` با پرونده خودم چک می‌شه، نه کلید دسترسی. فقط مدیریت چرخه (`performance_review_cycles`) و ساخت/override بررسی‌ها زیر `hr.manage` می‌مونه؛ مشاهده فهرست/جزئیات یک بررسی توسط HR زیر `hr.view`.

## اسکیمای دیتابیس (عیناً از `erp-schema.sql`)

```sql
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
    file_url           TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'finalized', 'paid')),
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payroll_period_id, employee_id)
);

CREATE TABLE payslip_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id   UUID NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
    item_type    VARCHAR(10) NOT NULL
                 CHECK (item_type IN ('earning', 'deduction')),
    category     VARCHAR(100) NOT NULL,
    description  VARCHAR(300),
    amount       NUMERIC(18,4) NOT NULL
);

ALTER TABLE employee_loan_installments
    ADD CONSTRAINT fk_loan_installments_payslip
    FOREIGN KEY (deducted_in_payslip_id) REFERENCES payslips(id);

CREATE TABLE performance_review_cycles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_name  VARCHAR(150) NOT NULL,
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
    reviewer_id        UUID NOT NULL REFERENCES employees(id),
    overall_score      NUMERIC(5,2),
    self_review_notes  TEXT,
    manager_notes      TEXT,
    status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'submitted', 'acknowledged')),
    submitted_at       TIMESTAMPTZ,
    acknowledged_at    TIMESTAMPTZ,
    UNIQUE (cycle_id, employee_id)
);

CREATE TABLE performance_review_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
    criterion_name  VARCHAR(150) NOT NULL,
    weight_percent  NUMERIC(5,2),
    score           NUMERIC(5,2),
    comments        TEXT
);
```

Migration: `0013_hr_payroll_performance`.

## Endpoint ها

| Method | Path | دسترسی | توضیح |
|---|---|---|---|
| GET | `/payroll-periods` | `hr.view` | فهرست دوره‌ها |
| POST | `/payroll-periods` | `hr.manage` | ساخت دوره جدید |
| POST | `/payroll-periods/:id/finalize` | `hr.manage` | نهایی‌سازی دوره + قفل فیش‌ها |
| POST | `/payroll-periods/:id/mark-paid` | `hr.manage` | ثبت پرداخت دوره |
| GET | `/payroll-periods/:id/payslips` | `hr.view` | فیش‌های یک دوره |
| POST | `/payroll-periods/:id/payslips/:employeeId/generate` | `hr.manage` | تولید/تولید مجدد فیش یک پرسنل |
| GET | `/employees/:id/payslips` | `hr.view` | تاریخچه فیش‌های یک پرسنل (نمای HR) |
| GET | `/payslips/mine` | لاگین‌شده (خودم) | فیش‌های `finalized`/`paid` خودم |
| GET | `/performance-review-cycles` | لاگین‌شده | فهرست دوره‌های ارزیابی (برای انتخاب در فرم‌ها هم لازمه) |
| POST | `/performance-review-cycles` | `hr.manage` | ساخت دوره ارزیابی |
| POST | `/performance-review-cycles/:id/close` | `hr.manage` | بستن دوره |
| POST | `/performance-reviews` | `hr.manage` | ساخت بررسی (پرسنل+ارزیاب+معیارها) |
| GET | `/employees/:id/performance-reviews` | `hr.view` | تاریخچه بررسی‌های یک پرسنل |
| GET | `/performance-reviews/mine-as-employee` | لاگین‌شده (خودم) | بررسی‌هایی که موضوعشونم |
| GET | `/performance-reviews/mine-as-reviewer` | لاگین‌شده (خودم) | بررسی‌هایی که ارزیابشونم |
| PATCH | `/performance-reviews/:id/self-review` | لاگین‌شده (فقط پرسنل موضوع، فقط `draft`) | ثبت/ویرایش خودارزیابی |
| PATCH | `/performance-reviews/:id/submit` | لاگین‌شده (فقط ارزیاب، فقط `draft`) | ثبت نمرات معیارها + `overall_score`/`manager_notes` + ارسال |
| POST | `/performance-reviews/:id/acknowledge` | لاگین‌شده (فقط پرسنل موضوع، فقط `submitted`) | تأیید مشاهده نتیجه |
| PATCH | `/performance-reviews/:id` | `hr.manage` | ویرایش override (هر فیلد/وضعیتی) |

## Frontend

- تب جدید «فیش‌های حقوقی» در `/hr`: انتخاب شرکت گروه + ماه/سال → ساخت دوره → جدول پرسنل اون شرکت با دکمه «تولید فیش» هرکدوم (یا «تولید همه») → پیش‌نمایش ریز اقلام قبل از نهایی‌سازی → دکمه‌های «نهایی‌سازی دوره»/«ثبت پرداخت».
- تب جدید «ارزیابی عملکرد» در `/hr`: مدیریت دوره‌ها + دکمه «بررسی جدید» (انتخاب پرسنل، ارزیاب — پیش‌فرض سرپرست مستقیم فعلی، معیارها).
- بخش «فیش‌های من» و «ارزیابی‌های من» در `ProfilePage` (کنار «درخواست‌های من» فاز ۱۹/۲۰): فیش‌های نهایی‌شده با ریز اقلام؛ خودارزیابی‌های `draft` با فرم متن + بررسی‌هایی که به‌عنوان ارزیاب باید تکمیل کنم (فرم نمره‌دهی معیارها) + بررسی‌های `submitted` منتظر تأیید مشاهده من.
- صفحه جزئیات پرسنل (`/hr`) دو بخش جدید فقط‌خواندنی می‌گیره: «فیش‌های حقوقی» و «ارزیابی‌های عملکرد».

## خارج از محدوده این زیرفاز

- ماژول آموزش (`training_courses`/`training_sessions`/`training_enrollments`) — کلاً حذف شد
- تبدیل ارز خودکار بین فیش و مزایا/کسورات با ارز متفاوت
- فرمول محاسبه مالیات/بیمه (سوال باز قدیمی دامنه ۱۱)
- تولید فایل PDF فیش حقوقی (`payslips.file_url` می‌مونه ولی این فاز پرش نمی‌کنه)
- بعد از این زیرفاز، کل دامنه ۱۱ (منابع انسانی) تکمیل می‌شه؛ فاز بعدی طبق نقشه‌راه تأییدشده می‌ره سراغ دامنه خزانه‌داری

## معیار پذیرش

- Migration `0013_hr_payroll_performance` دیپلوی می‌شه + مدل‌های Prisma + `ALTER TABLE` تکمیل `employee_loan_installments.deducted_in_payslip_id`
- تولید فیش، اقلام رو درست از هر ۵ منبع جمع می‌کنه و جمع‌های `base_salary`/`total_*`/`net_amount` صحیحن
- تولید فیش، اقساط وام سررسیددار اون دوره رو به `deducted` تغییر می‌ده و `deducted_in_payslip_id` رو وصل می‌کنه؛ تولید مجدد فیش `draft` این رو برمی‌گردونه
- نهایی‌سازی دوره همه فیش‌هاش رو قفل می‌کنه؛ تولید مجدد روی فیش `finalized`/`paid` رد می‌شه
- پرسنل فقط فیش‌های `finalized`/`paid` خودشو می‌بینه، نه `draft`
- گردش ارزیابی: فقط پرسنل موضوع می‌تونه در `draft` خودارزیابی بنویسه؛ فقط ارزیاب تعیین‌شده (نه سرپرست مستقیم) می‌تونه نمره بده و ارسال کنه؛ فقط پرسنل موضوع می‌تونه بعد از `submitted` تأیید مشاهده بزنه
- تست‌های Jest برای: محاسبه صحیح تجمیع فیش (شامل بستن حلقه قسط وام)، رد تولید مجدد روی فیش قفل‌شده، رد خودارزیابی/ثبت‌نمره توسط فرد نامرتبط
- E2E زنده روی DB واقعی (یک سناریوی کامل: قرارداد+مزایا+کسر+اضافه‌کاری تأییدشده+قسط وام سررسید همون ماه → تولید فیش → بررسی اقلام و قفل‌شدن قسط) + تلاش برای تایید بصری + به‌روزرسانی `README.md`
