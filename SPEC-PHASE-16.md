# SPEC — فاز ۱۶: مرکز فعالیت‌ها (Action Center) — بخش ۱: هستهٔ Activity

> این فاز اول از ۳ زیرفاز پشت‌سرهمه (طبق تصمیم شما):
> **فاز ۱۶ (این سند)** = هستهٔ Activity (مدل، CRUD، اتصال چندریختی، گردش وضعیت، Timeline پایه)
> **فاز ۱۷** = نتایج ساختاریافته (Structured Outcomes) + قالب‌های سفارشی + Auto Follow-up Engine
> **فاز ۱۸** = Escalation Engine + ویجت غنی داشبورد (Quick Actions) + Collaboration (Assign/Reassign/Mention/Comment/Attach) + Audit Trail کامل
>
> بدون Mockup بصری — این یک ماژول کاملاً جدیده و در `mockups/` نمونه‌ای نداره.

## زمینه و تصمیمات کلیدی (طبق پاسخ‌های شما به سؤالات دامنه)

1. **رابطه با سیستم‌های موجود**: Activities **جایگزین** ماژول Reminders (فاز ۱۴) می‌شه — یک Activity از نوع `reminder` دقیقاً همون UX رو پوشش می‌ده (خودم برای خودم، سررسید، تیک تکمیل) با قابلیت‌های خیلی بیشتر. فید خودکار هر پرونده (`inquiry_discussions`, دامنه ۲، `ActivityLogService`) دست‌نخورده می‌مونه و **جایگزین نمی‌شه** — Activities فقط مکمل اون فیده: وقتی Activity متصل به یک Inquiry تکمیل/لغو بشه، یک رکورد `activity` هم طبق همون الگوی موجود در فید پرونده درج می‌شه.
2. **حذف Reminders**: جدول `reminders` و کل ماژولش رو خودمون در فاز ۱۴ اضافه کردیم (بخشی از `erp-schema.sql` پایه نیست، پس تغییرش نقض قانون «schema پایه غیرقابل‌تغییره» نیست). این فاز: `RemindersModule` بک‌اند کامل حذف، جدول `reminders` با Migration جدید `DROP` می‌شه، ویجت TODO در مسیر `/` با ویجت «فعالیت‌های من» (بر پایهٔ Activities) جایگزین می‌شه.
3. **تشخیص مدیر برای Escalation**: در فاز ۱۸ پیاده می‌شه، بر اساس عضویت در گروه دسترسی پیش‌فرض «مدیریت» — بدون افزودن فیلد `manager_id`/`reports_to` جدید (چون چنین رابطه‌ای هیچ‌جای دیتابیس فعلی وجود نداره و طبق تصمیم شما لازم نیست اضافه بشه).
4. **دامنهٔ موجودیت‌های متصل در نسخهٔ اول**: فقط **استعلام (Inquiry)**. معماری چندریختی (`related_entity_type` + `related_entity_id`، دقیقاً الگوی موجود در `notifications`/`reminders`) کاملاً عمومیه؛ افزودن موجودیت‌های بعدی (مشتری/تأمین‌کننده، سفارش، فاکتور) فقط نیاز به یک مقدار جدید در همون فیلد داره، نه تغییر ساختار دیتابیس.

## هدف فاز ۱۶

هستهٔ Activity: مدل داده، CRUD کامل، اتصال چندریختی (فعلاً فقط به Inquiry سیم‌کشی‌شده)، گردش وضعیت استاندارد (`Open → Scheduled/Waiting → Overdue → Completed/Cancelled`) با Cron خودکار برای Overdue + اعلان، و یک Timeline پایه (لیست فعالیت‌های هر پرونده + ویجت «فعالیت‌های من» در داشبورد که جای Reminders رو می‌گیره).

## ⚠️ تصمیمات طراحی

1. **بدون جدول Outcome/Comment/Audit-log مستقل در این فاز** — طبق تقسیم‌بندی توافق‌شده به فاز ۱۷ (نتایج ساختاریافته) و فاز ۱۸ (Collaboration + Audit Trail) موکول شدن. `activities.outcome_note` (متن آزاد) موقتاً جای نتیجهٔ ساختاریافته رو می‌گیره؛ فاز ۱۷ با `outcome_id` (FK به جدول جدید نتایج) تکمیلش می‌کنه — دقیقاً الگوی افزودن FK بعد از ساخت جدول وابسته که در کل پروژه (مثل `inquiry_items.selected_offer_item_id`) تکرار شده.
2. **اولویت (Priority)**: چهار سطح `low/normal/high/urgent` — صراحتاً پرسیده نشد ولی برای هر موتور اولویت‌بندی در ویجت داشبورد (فاز ۱۸) لازمه؛ تصمیم کم‌ریسک و مستند‌شده.
3. **Cron وضعیت Overdue**: دقیقاً الگوی `RfqsScheduler`/`RemindersScheduler` موجود — هر ۱۵ دقیقه، فعالیت‌های `open`/`scheduled`/`waiting` که `due_at` گذشته رو به `overdue` تغییر می‌ده + یک اعلان نوع `activity_overdue` به مسئول (`assigned_to_user_id`) می‌ده (با guard جلوگیری از تکرار، دقیقاً مثل الگوی `reminder_due` سابق).
4. **دسترسی/حریم خصوصی** (بدون کلید RBAC جدید در این فاز):
   - هر کاربر فعالیت‌های خودش (مسئول یا سازنده) رو می‌بینه/ویرایش می‌کنه.
   - اگه فعالیت به یک Inquiry وصله، هر کسی که به اون Inquiry دسترسی داره (`inquiry.view`) فعالیت‌های اون پرونده رو هم می‌بینه (Timeline پرونده باید برای همهٔ اعضای مرتبط قابل مشاهده باشه) — ولی فقط مسئول/سازنده/مدیریت می‌تونن ویرایش/تکمیل کنن.
   - اعضای گروه پیش‌فرض «مدیریت» همهٔ فعالیت‌ها رو می‌بینن (پیش‌زمینهٔ لازم برای Escalation در فاز ۱۸).
5. **واگذاری (Assign)**: پایه‌ش همین فاز گذاشته می‌شه (`assigned_to_user_id` قابل تغییر توسط سازنده/مسئول فعلی/عضو مدیریت) — بدون این حتی تست پایه‌ای Activity بی‌معنیه. UI کامل Reassign با تاریخچه + Mention + Comment + Attach (Collaboration) در فاز ۱۸ میاد؛ فعلاً فقط یک Select سادهٔ «واگذاری به» در فرم.
6. **فیلدهای VoIP/AI-Ready**: چون این یک الزام معماری صریح برای همین هستهٔ اصلیه («معماری ماژول باید از ابتدا آماده باشه»)، دو ستون `call_recording_url` و `ai_summary` همین فاز اضافه می‌شن (Nullable، کاملاً بدون استفاده فعلی) — نه اینکه به فاز بعد موکول بشن.

## مدل داده

Migration جدید: `0008_activities` — `DROP TABLE reminders` + `CREATE TABLE activities`.

```sql
CREATE TABLE activities (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type         VARCHAR(30) NOT NULL
                              CHECK (activity_type IN ('call','email','meeting','follow_up','reminder','approval','internal_task')),
    subject               VARCHAR(300) NOT NULL,
    description           TEXT,
    related_entity_type   VARCHAR(30),   -- فعلاً فقط 'inquiry'؛ NULL یعنی فعالیت شخصی بدون اتصال (جایگزین Reminder قدیمی)
    related_entity_id     UUID,
    priority              VARCHAR(20) NOT NULL DEFAULT 'normal'
                              CHECK (priority IN ('low','normal','high','urgent')),
    status                VARCHAR(20) NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','scheduled','waiting','overdue','completed','cancelled')),
    scheduled_at          TIMESTAMPTZ,
    due_at                TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    assigned_to_user_id   UUID NOT NULL REFERENCES users(id),
    created_by_user_id    UUID NOT NULL REFERENCES users(id),
    outcome_note          TEXT,   -- موقت — فاز ۱۷ با outcome_id ساختاریافته تکمیلش می‌کنه
    follow_up_of_activity_id UUID REFERENCES activities(id),  -- زنجیرهٔ پیگیری (فعال‌سازی خودکارش در فاز ۱۷)
    call_recording_url    TEXT,   -- VoIP-ready، فعلاً بدون استفاده
    ai_summary            TEXT,   -- AI-ready، فعلاً بدون استفاده
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_assigned ON activities (assigned_to_user_id, status);
CREATE INDEX idx_activities_related ON activities (related_entity_type, related_entity_id);

DROP TABLE reminders;
```

## بک‌اند (ماژول جدید `ActivitiesModule`)

| Endpoint | توضیح |
|---|---|
| `GET /activities` | لیست با فیلتر `?assignedToMe=true`، `?relatedEntityType=inquiry&relatedEntityId=X`، `?status=` |
| `POST /activities` | ایجاد (نوع، موضوع، توضیح، اتصال اختیاری، اولویت، سررسید/زمان‌بندی، مسئول) |
| `PATCH /activities/:id` | ویرایش عمومی (موضوع، توضیح، اولویت، سررسید، واگذاری) |
| `POST /activities/:id/complete` | تکمیل (`outcomeNote` + وضعیت → `completed`) — اگه به Inquiry وصله، یک رکورد در `inquiry_discussions` هم طبق `ActivityLogService` درج می‌کنه |
| `POST /activities/:id/cancel` | لغو |
| Cron `ActivitiesScheduler` | هر ۱۵ دقیقه → گذشته از سررسید را `overdue` می‌کنه + اعلان `activity_overdue` |

## فرانت‌اند

- **مسیر `/`**: ویجت «فعالیت‌های من» جایگزین ویجت یادآور قدیمی — چک‌لیست فعالیت‌های باز/سررسیدشدهٔ من با افزودن سریع (پیش‌فرض نوع `internal_task`، بدون اتصال)
- **تب جدید در `InquiryDetailPage`**: «فعالیت‌ها» — لیست فعالیت‌های متصل به همون پرونده (Timeline پایه) + فرم افزودن سریع با انتخاب نوع/مسئول/سررسید
- حذف کامل فایل‌های Reminders قدیمی فرانت (`pages/dashboard/reminders-api.ts` جایگزین می‌شه با `activities-api.ts`) و بک‌اند (`apps/api/src/reminders/*` حذف کامل)

## خارج از اسکوپ فاز ۱۶ (برای فاز ۱۷/۱۸)

- نتایج ساختاریافته + قالب‌های سفارشی نتیجه + Auto Follow-up Engine (فاز ۱۷)
- Escalation Engine، ویجت غنی داشبورد با Quick Actions، Assign/Reassign با تاریخچه، Mention/Comment/Attach، Audit Trail کامل (فاز ۱۸)
- اتصال به مشتری/تأمین‌کننده/سفارش/فاکتور (معماری آماده‌ست، فقط بعداً سیم‌کشی می‌شه — خارج از این ۳ فاز)
- VoIP/AI واقعی (فقط فیلدهای آماده در دیتابیس، بدون هیچ اتصال واقعی)

## تست‌ها

- **Jest**: Cron تبدیل به Overdue + عدم تکرار اعلان در اجراهای پیاپی؛ قانون دسترسی (فقط مسئول/سازنده/دارندهٔ `inquiry.view`/عضو مدیریت می‌بینه؛ فقط مسئول/سازنده/مدیریت ویرایش می‌کنه)
- **E2E زنده**: ایجاد Activity متصل به یک Inquiry → در Timeline پرونده دیده می‌شه؛ تکمیل → رکورد جدید در `inquiry_discussions` درج می‌شه؛ اجرای دستی Cron روی یک فعالیت با سررسید گذشته → وضعیت `overdue` + اعلان؛ واگذاری به همکار → `assignedToUserId` عوض می‌شه؛ ویجت «فعالیت‌های من» در داشبورد کار می‌کنه

## Definition of Done

- [ ] Migration `0008_activities` (`DROP reminders` + `CREATE activities`) + مدل Prisma + `generate`
- [ ] `ActivitiesModule` کامل (CRUD + complete/cancel + Cron Overdue)
- [ ] حذف کامل `RemindersModule` بک‌اند و همهٔ ارجاعات فرانت به Reminders
- [ ] وب: ویجت «فعالیت‌های من» در `/` + تب «فعالیت‌ها» در جزئیات استعلام
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README
