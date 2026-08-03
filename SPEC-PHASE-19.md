# SPEC — فاز ۱۹: منابع انسانی، زیرفاز B — حضور و غیاب + مرخصی + مأموریت + اضافه‌کاری

> بخش سوم از ۴ زیرفاز منابع انسانی (بعد از فاز ۱۸ = زیرفاز A: ساختار سازمانی + پرسنل).
> جداول این زیرفاز از `erp-schema.sql` (بخش «حضور و غیاب»، «مرخصی»، «مأموریت»، «اضافه‌کاری» در دامنه ۱۱) عیناً کپی می‌شن.

## هدف

پیاده‌سازی ۴ زیرماژول:
1. **حضور و غیاب** (`attendance_records`) — ثبت دستی روزانه توسط کارشناس HR
2. **مرخصی** (`leave_types`, `leave_balances`, `leave_requests`) — خودسرویس پرسنل + تأیید سرپرست مستقیم
3. **مأموریت** (`mission_requests`) — خودسرویس پرسنل + تأیید سرپرست مستقیم
4. **اضافه‌کاری** (`overtime_records`) — خودسرویس پرسنل + تأیید سرپرست مستقیم

## تصمیمات طراحی (بر اساس پاسخ‌های تأییدشده)

1. **خودسرویس پرسنل با اتصال به حساب کاربری** — مرخصی/مأموریت/اضافه‌کاری رو خود پرسنل ثبت می‌کنه، نه کارشناس HR. این یعنی فقط پرسنلی که `employees.user_id` پرشون هست می‌تونن از این بخش استفاده کنن. یک Endpoint جدید `GET /me/employee` مشخص می‌کنه کاربر لاگین‌شده به کدوم رکورد `employees` وصله (یا `null` اگه وصل نیست — در این حالت UI پیام «پرونده پرسنلی متصل به این حساب نداری، از HR بخواه وصل کنه» رو نشون می‌ده و فرم‌ها غیرفعالن).
2. **تأیید فقط توسط سرپرست مستقیم** — `approver_id` باید دقیقاً `employees.direct_manager_id` همون پرسنل باشه؛ نه گروه مدیریت، نه کارشناس HR. یعنی برای تأیید/رد، کاربر لاگین‌شده باید پرونده `employees` مرتبطش (از طریق `user_id`) دقیقاً همون سرپرست مستقیم پرسنل درخواست‌دهنده باشه. **نکته حاشیه‌ای:** اگه سرپرست مستقیم پرسنلی حساب کاربری نداشته باشه (`direct_manager_id` پر ولی `user.id` متناظرش خالی)، اون درخواست عملاً قابل تأیید از داخل برنامه نیست تا وقتی سرپرست حساب کاربری بگیره — این محدودیت شناخته‌شده‌ست، نه باگ.
3. **کارشناس HR (`hr.manage`) فقط دیدِ فقط‌خواندنی داره، نه تأیید** — روی صفحه جزئیات پرسنل (فاز ۱۸) بخش‌های جدید «حضور و غیاب»، «مرخصی‌ها»، «مأموریت‌ها»، «اضافه‌کاری» به‌صورت فقط‌نمایشی (تاریخچه) اضافه می‌شه؛ HR نمی‌تونه از اونجا تأیید/رد کنه (طبق تصمیم ۲). HR فقط می‌تونه: `leave_types` (کاتالوگ نوع مرخصی) رو مدیریت کنه، `leave_balances` (سقف سالانه هر نوع مرخصی برای هر پرسنل) رو مقداردهی/ویرایش کنه، و `attendance_records` رو دستی ثبت/ویرایش کنه.
4. **همگام‌سازی خودکار حضور⇄مرخصی** — وقتی یک `leave_request` تأیید می‌شه، به‌ازای هر روز بین `start_date` و `end_date` (شامل خود دو سر بازه)، یک رکورد `attendance_records` با `status='on_leave'` و `source='manual'` upsert می‌شه (اگه رکورد اون روز از قبل بود، بازنویسی می‌شه — چون مرخصی تأییدشده مرجع نهاییه). اگه یک `leave_request` بعداً لغو بشه (`cancelled` — فقط قبل از تأیید مجازه، پس این حالت اصلاً به `attendance_records` نمی‌رسه چون هنوز تأیید نشده).
5. **مقداردهی اولیه `leave_balances`** — دستی توسط HR (نه خودکار). فرم «تعیین سقف مرخصی» روی جزئیات پرسنل: انتخاب نوع مرخصی + سال + `entitled_days` (پیش‌فرض از `leave_types.annual_entitlement_days` پر می‌شه ولی قابل تغییره). اگه پرسنلی برای یک نوع/سال خاص `leave_balances` نداشته باشه، درخواست مرخصی اون نوع رد می‌شه با پیام «سقف مرخصی این نوع برای شما تعریف نشده — به HR اطلاع بده».
6. **کسر خودکار `used_days`** — وقتی `leave_request` تأیید می‌شه، `leave_balances.used_days` همون پرسنل/نوع/سال به‌اندازه `days_count` افزایش پیدا می‌کنه. اگه `used_days` جدید از `entitled_days` بیشتر بشه، تأیید مسدود نمی‌شه (سرپرست ممکنه آگاهانه اجازه مرخصی بدون‌حقوق/تجاوز بده) ولی در UI به سرپرست هشدار داده می‌شه («این پرسنل X روز بیشتر از سقفش مرخصی گرفته»).
7. **`days_count` محاسبه خودکار ساده** — تعداد روز تقویمی بین `start_date` و `end_date` (شامل هر دو سر، بدون در نظر گرفتن تعطیلات آخر هفته یا رسمی — چون تقویم تعطیلات رسمی هنوز در سیستم تعریف نشده). قابل نمایش قبل از ثبت، غیرقابل‌ویرایش دستی.
8. **حضور و غیاب فقط ثبت دستی HR در این زیرفاز** — طبق سوال باز مستندسازی‌شده در `erp-database-design.md` (اتصال به دستگاه فیزیکی هنوز مشخص نشده)، فقط فرم دستی «ثبت/ویرایش وضعیت یک روز برای یک پرسنل» ساخته می‌شه (`source='manual'`); یک تقویم ماهانه ساده (لیست روزها + وضعیت) روی جزئیات پرسنل نمایش داده می‌شه، نه یک ماژول سراسری جدا.
9. **`mission_requests.related_expense_request_id`** — طبق الگوی تکرارشده در پروژه (ستون بدون FK تا ساخته‌شدن جدول مقصد)، این ستون در این فاز اصلاً به مدل Prisma/فرم اضافه نمی‌شه؛ چون `expense_requests` (دامنه خزانه‌داری) هنوز ساخته نشده. ستون در دیتابیس هست (طبق `erp-schema.sql`) ولی بلااستفاده می‌مونه تا فاز خزانه‌داری با `ALTER TABLE` واقعاً وصلش کنه.
10. **`overtime_records.calculated_amount`** — طبق سوال باز مستندسازی‌شده (فرمول دقیق قانون کار مشخص نشده)، این فیلد **دستی** توسط پرسنل هنگام ثبت درخواست وارد می‌شه (اختیاری، می‌تونه خالی بمونه)؛ سیستم فرمولی محاسبه نمی‌کنه، فقط `rate_multiplier` رو با پیش‌فرض ۱٫۴ نگه می‌داره.
11. **دسترسی جدید لازم نیست** — طبق الگوی صفحه پروفایل (فاز ۱۵)، Endpoint های خودسرویس (ثبت/مشاهده/لغو درخواست خودم) و Endpoint های تأیید سرپرست (چون بر مبنای رابطه سازمانی چک می‌شن، نه یک دسترسی عمومی) نیازی به کلید RBAC جدید ندارن — با آرایه خالی `@RequirePermissions()` پیاده می‌شن، دقیقاً مثل `users/me`. فقط Endpoint های مدیریتی HR (کاتالوگ نوع مرخصی، مقداردهی سقف، ثبت حضور دستی، مشاهده تاریخچه در جزئیات پرسنل) زیر `hr.view`/`hr.manage` موجود می‌مونن.

## اسکیمای دیتابیس (عیناً از `erp-schema.sql`)

```sql
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

CREATE TABLE leave_types (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name                VARCHAR(100) NOT NULL,
    is_paid                  BOOLEAN NOT NULL DEFAULT true,
    annual_entitlement_days  NUMERIC(5,1)
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
    attachment_file_url  TEXT,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approver_id          UUID REFERENCES employees(id),
    approved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    related_expense_request_id  UUID,  -- بدون FK فعلاً؛ در فاز خزانه‌داری با ALTER وصل می‌شه
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE overtime_records (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date          DATE NOT NULL,
    hours              NUMERIC(5,2) NOT NULL,
    reason             TEXT,
    rate_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.4,
    calculated_amount  NUMERIC(18,4),
    currency_code      VARCHAR(3) REFERENCES currencies(currency_code),
    status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    approver_id        UUID REFERENCES employees(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration: `0011_hr_attendance_leave`.

## Endpoint ها

| Method | Path | دسترسی | توضیح |
|---|---|---|---|
| GET | `/me/employee` | لاگین‌شده | پرونده پرسنلی متصل به کاربر جاری (یا `null`) |
| GET | `/leave-types` | لاگین‌شده | کاتالوگ فعال (برای فرم خودسرویس هم لازمه) |
| POST | `/leave-types` | `hr.manage` | ثبت نوع مرخصی جدید |
| PATCH | `/leave-types/:id` | `hr.manage` | ویرایش نوع مرخصی |
| GET | `/leave-balances/me?year=` | لاگین‌شده (خودم) | مانده مرخصی‌های خودم |
| GET | `/employees/:id/leave-balances?year=` | `hr.view` | مانده مرخصی یک پرسنل (نمای HR) |
| POST | `/employees/:id/leave-balances` | `hr.manage` | تعیین/ویرایش سقف سالانه یک نوع مرخصی |
| POST | `/leave-requests` | لاگین‌شده (خودم) | ثبت درخواست مرخصی جدید |
| GET | `/leave-requests/mine` | لاگین‌شده (خودم) | تاریخچه درخواست‌های خودم |
| POST | `/leave-requests/:id/cancel` | لاگین‌شده (فقط ثبت‌کننده، فقط `pending`) | لغو درخواست |
| GET | `/leave-requests/pending-approval` | لاگین‌شده (فقط سرپرست) | صف تأیید تیم من |
| POST | `/leave-requests/:id/approve` | لاگین‌شده (فقط سرپرست مستقیم) | تأیید + کسر `used_days` + همگام‌سازی حضور |
| POST | `/leave-requests/:id/reject` | لاگین‌شده (فقط سرپرست مستقیم) | رد |
| GET | `/employees/:id/leave-requests` | `hr.view` | تاریخچه کامل (نمای HR، فقط‌خواندنی) |
| POST | `/mission-requests` | لاگین‌شده (خودم) | ثبت درخواست مأموریت |
| GET | `/mission-requests/mine` | لاگین‌شده (خودم) | تاریخچه خودم |
| POST | `/mission-requests/:id/cancel` | لاگین‌شده (فقط ثبت‌کننده، فقط `pending`) | لغو |
| GET | `/mission-requests/pending-approval` | لاگین‌شده (فقط سرپرست) | صف تأیید تیم من |
| POST | `/mission-requests/:id/approve` \| `/reject` | لاگین‌شده (فقط سرپرست مستقیم) | تأیید/رد |
| GET | `/employees/:id/mission-requests` | `hr.view` | تاریخچه (نمای HR) |
| POST | `/overtime-records` | لاگین‌شده (خودم) | ثبت درخواست اضافه‌کاری |
| GET | `/overtime-records/mine` | لاگین‌شده (خودم) | تاریخچه خودم |
| POST | `/overtime-records/:id/cancel` | لاگین‌شده (فقط ثبت‌کننده، فقط `pending`) | لغو |
| GET | `/overtime-records/pending-approval` | لاگین‌شده (فقط سرپرست) | صف تأیید تیم من |
| POST | `/overtime-records/:id/approve` \| `/reject` | لاگین‌شده (فقط سرپرست مستقیم) | تأیید/رد |
| GET | `/employees/:id/overtime-records` | `hr.view` | تاریخچه (نمای HR) |
| GET | `/employees/:id/attendance?month=&year=` | `hr.view` | تقویم حضور یک ماه |
| POST | `/employees/:id/attendance` | `hr.manage` | ثبت/ویرایش دستی یک روز (upsert) |

## Frontend

- **`ProfilePage`** (فاز ۱۵) یک تب/بخش جدید «درخواست‌های من» می‌گیره: خلاصه مانده مرخصی + ۳ فرم ثبت سریع (مرخصی/مأموریت/اضافه‌کاری) + لیست تاریخچه با وضعیت (بادج رنگی) + دکمه لغو روی موارد `pending`. اگه `GET /me/employee` مقدار `null` برگردونه، به‌جای فرم‌ها پیام «پرونده پرسنلی متصل نداری» نشون داده می‌شه.
- **ویجت داشبورد جدید «تأییدیه‌های تیم من»** — فقط اگه `pending-approval` هر سه نوع جمعاً بیشتر از صفر باشه رندر می‌شه (هم‌الگو با ویجت «فعالیت‌های من»)؛ هر ردیف با دکمه تأیید/رد سریع.
- **صفحه جزئیات پرسنل (`/hr`، فاز ۱۸)** چهار بخش جدید فقط‌خواندنی/مدیریتی می‌گیره: «حضور و غیاب» (تقویم ماهانه + فرم ثبت دستی، `hr.manage`)، «مرخصی‌ها» (تاریخچه + فرم تعیین سقف سالانه)، «مأموریت‌ها» (تاریخچه)، «اضافه‌کاری» (تاریخچه) — طبق تصمیم ۳، بدون دکمه تأیید/رد اینجا.
- تب جدید «انواع مرخصی» در `/hr` (کنار «پرسنل»/«بخش‌ها») برای CRUD روی `leave_types` (`hr.manage`).

## خارج از محدوده این زیرفاز

- زیرفاز C (وام، مزایا/کسورات، درخواست‌های عمومی HR)
- زیرفاز D (فیش حقوقی، ارزیابی عملکرد، آموزش)
- تقویم تعطیلات رسمی/آخر هفته (برای محاسبه دقیق‌تر `days_count`)
- اتصال به دستگاه حضور فیزیکی
- زنجیره تأیید چندسطحی (فقط یک سطح: سرپرست مستقیم)
- اتصال `mission_requests.related_expense_request_id` به `expense_requests` واقعی (فاز خزانه‌داری)

## معیار پذیرش

- Migration `0011_hr_attendance_leave` دیپلوی می‌شه + مدل‌های Prisma اضافه می‌شن
- خودسرویس: پرسنلِ متصل به یک کاربر می‌تونه مرخصی/مأموریت/اضافه‌کاری ثبت و لغو (قبل از تأیید) کنه
- سرپرست مستقیم (و فقط اون) می‌تونه تأیید/رد کنه؛ تأیید مرخصی باعث upsert خودکار `attendance_records` و افزایش `used_days` می‌شه
- HR (`hr.manage`/`hr.view`) کاتالوگ مرخصی و سقف سالانه رو مدیریت می‌کنه و تاریخچه هر پرسنل رو فقط‌خواندنی می‌بینه؛ حضور و غیاب رو دستی ثبت می‌کنه
- تست‌های Jest برای: رد ثبت خودسرویس بدون پرونده پرسنلی، رد تأیید توسط غیر-سرپرست، کسر `used_days`، upsert حضور روی تأیید مرخصی
- E2E زنده روی DB واقعی + تلاش برای تایید بصری + به‌روزرسانی `README.md`
