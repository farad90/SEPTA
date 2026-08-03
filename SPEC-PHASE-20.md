# SPEC — فاز ۲۰: منابع انسانی، زیرفاز C — وام + مزایا/کسورات + درخواست‌های عمومی

> زیرفاز سوم از ۴ زیرفاز منابع انسانی (بعد از فاز ۱۸ = ساختار سازمانی+پرسنل، فاز ۱۹ = حضور/مرخصی/مأموریت/اضافه‌کاری).
> جداول این زیرفاز از `erp-schema.sql` (بخش «وام»، «مزایا و کسورات»، «درخواست‌ها — سرفصل عمومی» در دامنه ۱۱) عیناً کپی می‌شن.

## هدف

۳ زیرماژول:
1. **وام** (`employee_loans`, `employee_loan_installments`) — خودسرویس پرسنل + تأیید سرپرست مستقیم + تولید خودکار جدول اقساط
2. **مزایا و کسورات** (`benefit_types`, `employee_benefits`, `deduction_types`, `employee_deductions`) — کاملاً مدیریتی HR، بدون خودسرویس/تأیید (این‌ها تخصیص مستقیم HR‌ان، نه درخواست پرسنل)
3. **درخواست‌های عمومی** (`hr_requests`) — خودسرویس پرسنل + تأیید سرپرست مستقیم، برای مواردی که جدول اختصاصی ندارن (گواهی اشتغال، پیش‌پرداخت حقوق، تجهیزات، سایر)

## تصمیمات طراحی (بر اساس پاسخ‌های تأییدشده + ادامه‌ی الگوی فاز ۱۹)

1. **تأیید وام فقط توسط سرپرست مستقیم** — هم‌الگوی مرخصی/مأموریت/اضافه‌کاری (فاز ۱۹)، نه HR — با همون `HrAccessService.assertIsDirectManagerOf`. با اینکه وام مبلغ مالی داره، طبق تصمیم صریح، همچنان سرپرست مستقیم تنها مرجع تأییده (نه سطح تأیید مالی جدا).
2. **تولید خودکار جدول اقساط هنگام تأیید** — وقتی سرپرست وام رو تأیید می‌کنه، بلافاصله `installment_count` رکورد در `employee_loan_installments` ساخته می‌شه: `amount = loan_amount / installment_count`، `due_date` هرکدوم یک ماه بعد از قبلی شروع از `start_deduction_date` (فیلدی که پرسنل هنگام ثبت درخواست وارد می‌کنه). هم‌زمان وضعیت خود وام از `pending` مستقیم به `active` می‌ره (نه یک حالت میانی `approved` جدا — چون تأیید و فعال‌سازی هم‌زمانه). `deducted_in_payslip_id` هر قسط خالی می‌مونه — طبق الگوی تکرارشده در پروژه (`mission_requests.related_expense_request_id` در فاز ۱۹)، این ستون تا فاز حقوق (زیرفاز D) که `payslips` ساخته می‌شه بلااستفاده‌ست.
3. **لغو خودسرویس = وضعیت `rejected`** — طبق سوال باز مستندسازی‌شده در `erp-schema.sql`، `employee_loans.status` مقدار `cancelled` نداره (فقط `pending/approved/active/settled/rejected`)؛ پس مثل مأموریت/اضافه‌کاری فاز ۱۹، لغو خودسرویس پیش از تأیید هم روی `rejected` می‌شینه.
4. **`settled` خارج از این زیرفاز** — انتقال به `settled` (همه اقساط کسر شده) وابسته به فیش حقوقیه که هنوز نیست؛ در این فاز `employee_loan_installments.status` همیشه `pending` می‌مونه و هیچ Endpointی برای تغییرش نداریم.
5. **مزایا/کسورات کاملاً مدیریتی HR، بدون گردش تأیید** — چون در `erp-schema.sql` این جداول اصلاً فیلد `status`/`approver_id` ندارن (فقط `effective_from`/`effective_to`/`is_recurring`)، اینا تخصیص مستقیم HR‌ان (مثلاً «این پرسنل از این تاریخ حق مسکن X تومان می‌گیره»)، نه درخواستی که پرسنل ثبت کنه. بخش‌شون فقط زیر `hr.manage` (نوشتن) / `hr.view` (خواندن) میاد، هیچ Endpoint خودسرویسی ندارن.
6. **`employee_deductions.related_loan_id` اختیاری** — فرم ثبت کسر جدید یک Select اختیاری «مرتبط با کدوم وام» داره (از وام‌های همون پرسنل) — برای وقتی HR می‌خواد قسط وام رو به‌عنوان یک ردیف کسر عمومی هم ثبت کنه؛ ارتباط منطقیه ولی اجباری نیست (پروژه فعلاً مکانیزم خودکار وام→کسر نداره، دستیه).
7. **درخواست‌های عمومی (`hr_requests`) هم‌الگوی کامل خودسرویس + تأیید سرپرست فاز ۱۹** — چهارمین نوع درخواست کنار مرخصی/مأموریت/اضافه‌کاری در تب «درخواست‌های من» پروفایل؛ چهار نوع از پیش تعیین‌شده (`certificate`, `salary_advance`, `equipment`, `other`) + یک فیلد توضیح متنی آزاد. `related_entity_type`/`related_entity_id` طبق طراحی اصلی برای ارتباط اختیاری با موجودیت دیگه‌ست ولی چون هیچ مورد استفاده مشخصی در این زیرفاز نداره، در UI این فاز خالی می‌مونه (فقط ستون دیتابیس هست، فرم بهش دست نمی‌زنه).
8. **کاتالوگ‌های جدید در `/hr`** — دو تب جدید کنار «انواع مرخصی» (فاز ۱۹): «انواع مزایا» و «انواع کسورات»، هم‌الگوی همون CRUD ساده.

## اسکیمای دیتابیس (عیناً از `erp-schema.sql`)

```sql
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

CREATE TABLE employee_loan_installments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id                 UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    installment_number      INTEGER NOT NULL,
    due_date                DATE NOT NULL,
    amount                  NUMERIC(18,4) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'deducted')),
    deducted_in_payslip_id  UUID,
    UNIQUE (loan_id, installment_number)
);

CREATE TABLE benefit_types (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_name          VARCHAR(150) NOT NULL,
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
    deduction_name        VARCHAR(150) NOT NULL,
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
    related_loan_id    UUID REFERENCES employee_loans(id),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
```

Migration: `0012_hr_loans_benefits_requests`.

## Endpoint ها

| Method | Path | دسترسی | توضیح |
|---|---|---|---|
| POST | `/employee-loans` | لاگین‌شده (خودم) | ثبت درخواست وام |
| GET | `/employee-loans/mine` | لاگین‌شده (خودم) | تاریخچه خودم (شامل اقساط) |
| POST | `/employee-loans/:id/cancel` | لاگین‌شده (فقط ثبت‌کننده، فقط `pending`) | لغو |
| GET | `/employee-loans/pending-approval` | لاگین‌شده (فقط سرپرست) | صف تأیید تیم من |
| POST | `/employee-loans/:id/approve` | لاگین‌شده (فقط سرپرست مستقیم) | تأیید + تولید خودکار اقساط + `status→active` |
| POST | `/employee-loans/:id/reject` | لاگین‌شده (فقط سرپرست مستقیم) | رد |
| GET | `/employees/:id/loans` | `hr.view` | تاریخچه کامل (نمای HR، شامل اقساط) |
| GET | `/benefit-types` \| `/deduction-types` | لاگین‌شده | کاتالوگ‌ها (فقط مشاهده برای همه) |
| POST/PATCH | `/benefit-types` \| `/deduction-types` | `hr.manage` | CRUD کاتالوگ |
| GET | `/employees/:id/benefits` \| `/employees/:id/deductions` | `hr.view` | تخصیص‌های فعلی/تاریخی |
| POST | `/employees/:id/benefits` \| `/employees/:id/deductions` | `hr.manage` | تخصیص جدید |
| PATCH | `/employee-benefits/:id` \| `/employee-deductions/:id` | `hr.manage` | ویرایش (مثلاً بستن `effective_to`) |
| POST | `/hr-requests` | لاگین‌شده (خودم) | ثبت درخواست عمومی |
| GET | `/hr-requests/mine` | لاگین‌شده (خودم) | تاریخچه خودم |
| POST | `/hr-requests/:id/cancel` | لاگین‌شده (فقط ثبت‌کننده، فقط `pending`) | لغو |
| GET | `/hr-requests/pending-approval` | لاگین‌شده (فقط سرپرست) | صف تأیید تیم من |
| POST | `/hr-requests/:id/approve` \| `/reject` | لاگین‌شده (فقط سرپرست مستقیم) | تأیید/رد |
| GET | `/employees/:id/hr-requests` | `hr.view` | تاریخچه (نمای HR) |

## Frontend

- تب «درخواست‌های من» پروفایل (فاز ۱۹) یک زیرتب چهارم می‌گیره: «وام» (فرم مبلغ+تعداد قسط+تاریخ شروع کسر+دلیل، پیش‌نمایش زنده مبلغ هر قسط) و یک زیرتب پنجم «سایر درخواست‌ها» (نوع از دراپ‌داون + توضیح).
- ویجت «تأییدیه‌های تیم من» داشبورد دو نوع ردیف جدید می‌گیره (وام، درخواست عمومی) — هم‌الگوی سه نوع قبلی.
- صفحه جزئیات پرسنل (`/hr`) سه بخش جدید می‌گیره: «وام‌ها» (تاریخچه + اقساط)، «مزایا» (لیست فعلی + دکمه تخصیص جدید)، «کسورات» (لیست فعلی + دکمه تخصیص جدید) — دو مورد آخر مستقیماً قابل ثبت/ویرایش توسط HR (بدون گردش تأیید، طبق تصمیم ۵).
- دو تب جدید در `/hr`: «انواع مزایا»، «انواع کسورات» (CRUD ساده، هم‌الگوی «انواع مرخصی»).

## خارج از محدوده این زیرفاز

- زیرفاز D (فیش حقوقی، ارزیابی عملکرد، آموزش)
- انتقال خودکار وام به `settled` / کسر خودکار قسط در فیش حقوقی
- محاسبه خودکار مالیات/بیمه به‌عنوان `employee_deductions` (فرمول مشخص نیست — سوال باز موجود)

## معیار پذیرش

- Migration `0012_hr_loans_benefits_requests` دیپلوی می‌شه + مدل‌های Prisma
- خودسرویس: پرسنلِ متصل می‌تونه وام/درخواست عمومی ثبت و (قبل از تأیید) لغو کنه
- سرپرست مستقیم (و فقط اون) تأیید/رد می‌کنه؛ تأیید وام باعث تولید خودکار اقساط با مبلغ و تاریخ صحیح می‌شه
- HR کاتالوگ مزایا/کسورات رو مدیریت و تخصیص مستقیم (بدون تأیید) به پرسنل می‌ده؛ تاریخچه وام/درخواست هر پرسنل رو فقط‌خواندنی می‌بینه
- تست‌های Jest برای: محاسبه صحیح مبلغ هر قسط، تولید تعداد صحیح اقساط با تاریخ‌های ماهانه متوالی، رد تأیید توسط غیر-سرپرست، رد ثبت خودسرویس بدون پرونده پرسنلی
- E2E زنده روی DB واقعی + تلاش برای تایید بصری + به‌روزرسانی `README.md`
