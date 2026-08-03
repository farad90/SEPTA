# SPEC — فاز ۱۷: مرکز فعالیت‌ها (Action Center) — بخش ۲: نتایج ساختاریافته + Auto Follow-up Engine

> پیش‌نیاز: فاز ۱۶ ✅ (هستهٔ Activity). این دومین زیرفاز از ۳ زیرفاز توافق‌شده در SPEC-PHASE-16.
> فاز ۱۸ (باقی‌مانده): Escalation Engine + ویجت غنی داشبورد + Collaboration + Audit Trail کامل.
> بدون Mockup بصری.

## هدف فاز ۱۷

1. **نتایج ساختاریافته (Structured Outcomes)**: به‌جای فقط `outcome_note` آزاد، هر فعالیت هنگام تکمیل می‌تونه یک نتیجهٔ از پیش‌تعریف‌شده (قالب) انتخاب کنه — مثل «بی‌پاسخ»، «مشغول»، «تماس بعداً»، «منتظر تأمین‌کننده»، «با موفقیت انجام شد» — مخصوص هر نوع فعالیت (Call/Email/Meeting/...)، به‌همراه امکان تعریف قالب سفارشی توسط مدیریت.
2. **Auto Follow-up Engine**: اگه نتیجهٔ انتخاب‌شده «نیاز به پیگیری» داشته باشه، سیستم خودکار یک فعالیت پیگیری بعدی (با نوع و زمان از پیش تعیین‌شده در همون قالب) می‌سازه و به همون مسئول/پرونده وصل می‌کنه.

## ⚠️ تصمیمات طراحی

1. **مدل ذهنی «تکمیل + زنجیرهٔ پیگیری»** (نه «حالت انتظار روی همون رکورد»): وقتی نتیجه‌ای که نیاز به پیگیری داره انتخاب می‌شه، فعالیت **فعلی** همچنان `completed` می‌شه (کارِ همون قدمش انجام شده — مثلاً تماس گرفتی، جواب گرفتی که «بعداً تماس بگیر»)، و یک فعالیت **جدید** (`follow_up_of_activity_id` به فعالیت فعلی وصله) با سررسید محاسبه‌شده ساخته می‌شه. این ستون از فاز ۱۶ در schema موجوده، همین فاز واقعاً استفاده می‌شه.
2. **`activities.outcome_id`**: طبق تصمیم فاز ۱۶ (بخش ۱)، این FK با `ALTER TABLE` بعد از ساخت جدول `activity_outcome_templates` اضافه می‌شه — دقیقاً الگوی تکرارشدهٔ پروژه. `outcome_note` آزاد هم‌چنان موازی باقی می‌مونه (هم قالب هم توضیح آزاد قابل ثبته).
3. **قالب‌ها مخصوص هر نوع فعالیتن، نه سراسری** — `activity_type` روی خود قالب هست؛ انتخاب نتیجه در فرم تکمیل فقط قالب‌های همون نوع فعالیت رو نشون می‌ده.
4. **قالب پیش‌فرض vs سفارشی**: قالب‌های پیش‌فرض (`is_default=true`) در Seed درج می‌شن (شبیه گروه‌های دسترسی پیش‌فرض)؛ مدیریت می‌تونه قالب سفارشی جدید بسازه ولی **قالب‌های پیش‌فرض رو نمی‌تونه ویرایش/حذف کنه** (فقط قالب‌های خودش رو) — همون قانون‌مندی که در `PermissionGroup.isDefault` استفاده شده.
5. **بدون کلید RBAC جدید** — مدیریت قالب‌ها (ایجاد/ویرایش/حذف قالب سفارشی) فقط برای اعضای گروه پیش‌فرض «مدیریت» باز می‌شه (چک مستقیم `permissionGroup.groupName`، دقیقاً همون الگوی `isManagementGroupMember` که در فاز ۱۶ داخل `ActivitiesService` نوشته شد).
6. **محل UI مدیریت قالب‌ها**: تب جدید «قالب‌های نتیجه فعالیت» داخل صفحهٔ موجود `/users` («کاربران و گروه‌های دسترسی») — چون این صفحه از قبل مرکز تنظیمات ادمین سیستمه و به `users.manage` محدوده؛ نیازی به مسیر/آیتم منوی جدید نیست.
7. **فرم تکمیل فعالیت**: پنل «فعالیت‌ها» در جزئیات استعلام (ساخته‌شده در فاز ۱۶) از یک دکمهٔ تکمیل فوری به یک فرم کوچیک ارتقا پیدا می‌کنه (انتخاب نتیجه از لیست قالب‌های همون نوع + یادداشت آزاد اختیاری). ویجت «فعالیت‌های من» در داشبورد (چک‌باکس سریع) **تغییر نمی‌کنه** — انتخاب نتیجهٔ ساختاریافته اونجا اختیاریه و پیچیدگی UI رو زیاد می‌کنه؛ Quick Action غنی‌تر طبق تقسیم‌بندی توافق‌شده به فاز ۱۸ موکوله.
8. **لاگ زنجیرهٔ خودکار در فید پرونده**: وقتی فعالیت پیگیریِ خودکار ساخته می‌شه و فعالیت اصلی به یک Inquiry وصله، یک رکورد دیگه (علاوه بر رکورد تکمیل موجود از فاز ۱۶) در `inquiry_discussions` درج می‌شه: «فعالیت پیگیری خودکار … ایجاد شد».

## مدل داده

Migration جدید: `0009_activity_outcomes` — بدون تغییر/حذف چیزی از فاز ۱۶، فقط افزودن.

```sql
CREATE TABLE activity_outcome_templates (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type             VARCHAR(30) NOT NULL,
    label                     VARCHAR(200) NOT NULL,
    is_default                BOOLEAN NOT NULL DEFAULT false,
    requires_follow_up        BOOLEAN NOT NULL DEFAULT false,
    follow_up_activity_type   VARCHAR(30),   -- NULL یعنی همون نوع فعالیت اصلی
    follow_up_offset_minutes  INTEGER,       -- الزامی وقتی requires_follow_up=true
    created_by_user_id        UUID REFERENCES users(id),   -- NULL برای قالب‌های پیش‌فرض
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (activity_type, label)
);

ALTER TABLE activities
    ADD COLUMN outcome_id UUID REFERENCES activity_outcome_templates(id);
```

### قالب‌های پیش‌فرض (Seed)

| نوع فعالیت | نتیجه | نیاز به پیگیری | فاصلهٔ پیگیری |
|---|---|---|---|
| call | بی‌پاسخ | ✅ | ۴ ساعت بعد |
| call | مشغول | ✅ | ۲ ساعت بعد |
| call | تماس بعداً | ✅ | فردا همون ساعت |
| call | با موفقیت انجام شد | ❌ | — |
| email | بدون پاسخ | ✅ | ۲ روز بعد |
| email | پاسخ دریافت شد | ❌ | — |
| meeting | برگزار شد | ❌ | — |
| meeting | لغو/تعویق شد | ✅ | فردا همون ساعت |
| follow_up | منتظر تأمین‌کننده | ✅ | ۳ روز بعد |
| follow_up | منتظر مشتری | ✅ | ۳ روز بعد |
| follow_up | نتیجه گرفته شد | ❌ | — |
| approval | تأیید شد | ❌ | — |
| approval | رد شد | ❌ | — |
| approval | نیاز به بررسی بیشتر | ✅ | فردا همون ساعت |
| internal_task | انجام شد | ❌ | — |
| reminder | انجام شد | ❌ | — |

## بک‌اند

| Endpoint | توضیح |
|---|---|
| `GET /activity-outcome-templates?activityType=call` | لیست قالب‌های یک نوع (یا همه اگه فیلتر نشه) |
| `POST /activity-outcome-templates` | ایجاد قالب سفارشی (فقط مدیریت) |
| `PATCH /activity-outcome-templates/:id` | ویرایش قالب سفارشی خودش (فقط مدیریت، `is_default=false`) |
| `DELETE /activity-outcome-templates/:id` | حذف قالب سفارشی (فقط مدیریت، `is_default=false`) |

تغییر در `ActivitiesService.complete()`: بدنهٔ ورودی `{ outcomeId?, outcomeNote? }`؛ اگه `outcomeId` داده بشه و `requires_follow_up=true`، یک `Activity` جدید با `followUpOfActivityId` ساخته می‌شه (نوع/سررسید طبق قالب، مسئول و اتصال به پرونده مثل فعالیت اصلی) + لاگ دوم در `inquiry_discussions`.

## فرانت‌اند

- `ActivitiesPanel` (جزئیات استعلام): دکمهٔ تکمیل → فرم کوچیک (Select نتیجه از قالب‌های همون نوع + Textarea یادداشت اختیاری) → بعد از ثبت، اگه فعالیت پیگیری خودکار ساخته شده باشه، در همون لیست نشون داده می‌شه.
- `/users`: تب سوم «قالب‌های نتیجه فعالیت» — لیست بر اساس نوع فعالیت + فرم افزودن قالب سفارشی + حذف (فقط قالب‌های سفارشی).

## خارج از اسکوپ فاز ۱۷ (برای فاز ۱۸)

- Escalation Engine، ویجت غنی داشبورد با Quick Actions، Assign/Reassign با تاریخچه، Mention/Comment/Attach، Audit Trail کامل

## تست‌ها

- **Jest**: انتخاب نتیجهٔ `requiresFollowUp=true` → فعالیت پیگیری خودکار با `dueAt` و `followUpOfActivityId` درست ساخته می‌شه؛ انتخاب نتیجهٔ بدون پیگیری → فقط تکمیل، بدون فعالیت جدید؛ رد ویرایش/حذف قالب پیش‌فرض؛ رد ایجاد/ویرایش قالب توسط غیرمدیریت
- **E2E زنده**: تکمیل با نتیجهٔ «تماس بعداً» → فعالیت پیگیری جدید با سررسید فردا ساخته می‌شه و در Timeline پرونده دیده می‌شه + دو رکورد در فید پرونده (تکمیل + پیگیری خودکار)؛ ایجاد قالب سفارشی توسط ادمین (عضو مدیریت) و استفادهٔ فوریش

## Definition of Done

- [ ] Migration `0009_activity_outcomes` (`CREATE activity_outcome_templates` + `ALTER activities ADD outcome_id`) + مدل Prisma + `generate`
- [ ] Seed قالب‌های پیش‌فرض (۱۶ ردیف طبق جدول بالا)
- [ ] بک‌اند: `ActivityOutcomeTemplatesModule` (CRUD مدیریت-محور) + `ActivitiesService.complete()` با Auto Follow-up
- [ ] فرانت: فرم تکمیل با انتخاب نتیجه در `ActivitiesPanel` + تب مدیریت قالب در `/users`
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README
