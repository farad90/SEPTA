# SPEC — فاز ۱۳: مکاتبات و بایگانی اسناد (دامنه ۸)

> پیش‌نیاز: فاز ۱۲ ✅ (هر ۹ تب فرآیند سفارش کامل). مرجع بصری: `mockups/correspondence-mockup.jsx`.
> ماژول سراسری جدید — مسیر `/correspondence`، از قبل به‌عنوان Placeholder در نویگیشن موجوده.

## هدف فاز ۱۳

ثبت/پیگیری نامه‌های دریافتی/ارسالی/داخلی با شماره‌گذاری خودکار یکتا (بر مبنای شرکت گروه صادرکننده، نه جهت نامه)، بایگانی اسناد پیوستی با دسته‌بندی/برچسب، گردش کار (ارجاع/پاسخ/تأیید/ارسال/بایگانی)، و Audit Log بازدید/ویرایش.

## ⚠️ تصمیمات (شامل پاسخ‌های شما)

1. **مرجع mockup**: دو mockup برای این ماژول وجود داره که با هم تضاد دارن. `correspondence-mockup.jsx` **مرجع اصلی** است — دقیقاً مطابق schema فعلی (شماره‌گذاری بر مبنای `our_entity.short_code`، انتخاب‌گر ساختاریافته فرستنده/گیرنده). `correspondence-archive-mockup.jsx` نسخهٔ قدیمی/رد‌شده‌ست (شماره‌گذاری IN/OUT/MEMO بر مبنای جهت نامه + فرستنده/گیرنده متن آزاد — دقیقاً همون طرحی که `erp-database-design.md` می‌گه با «اصلاح مهم» جایگزین شده). فقط چند ایده UI مستقل از این تضاد (Audit Log، Stepper گردش کار) از نسخهٔ دوم قرض گرفته می‌شه.
2. **فیلتر «هر واحد فقط نامه‌های خودش رو ببینه»**: طبق تصمیم شما، `letters.department` با **نام گروه دسترسی کاربر** (`permission_group.group_name`) تطبیق داده می‌شه. کاربر گروه «فروش» فقط نامه‌های `department='فروش'` رو می‌بینه؛ کلید جدید `correspondence.view_all` این فیلتر رو کنار می‌ذاره (فقط مدیریت به‌صورت پیش‌فرض).
3. **یادآور/اعلان ارجاع**: طبق تصمیم شما، **کاملاً موکول به دامنه ۹** — چون به جداول سراسری `reminders`/`notifications` (هنوز ساخته‌نشده) وابسته‌ست، دقیقاً مثل وابستگی `warehouse_receipts` به `shipments` در فاز ۱۰. بخش «یادآور / مهلت پاسخ» mockup در این فاز نیست.
4. **سند مستقل بدون نامه** (`documents.related_letter_id IS NULL`): schema پشتیبانی می‌کنه ولی هیچ mockup ای UI براش نداره → خارج از اسکوپ این فاز (فقط اسناد پیوست‌شده به یک نامه).
5. **OCR** (`documents.ocr_text`): طبق design doc یک قابلیت جانبی اختیاره (Job پس‌زمینه با Tesseract) — خارج از اسکوپ این فاز، ستون در schema باقی می‌مونه خالی.
6. **شماره‌گذاری**: از جدول موجود `letter_counters` استفاده می‌شه (بدون Migration جدید) — کلید `(year, our_entity_id)`، سال بر اساس `our_entities.calendar_type` (شمسی برای شرکت ایرانی، میلادی برای بقیه) با `date-fns-jalali` محاسبه می‌شه. فرمت: `{سال}-{short_code}-{سریال ۴رقمی}` — مثلاً `1405-پ ت-0042`. شماره فقط بعد از «ثبت رسمی» صادر می‌شه (مطابق mockup).
7. **ویرایش بعد از ثبت رسمی**: مجاز می‌مونه (برای رفع اشتباهات تایپی) — بدون قفل — ولی هر ویرایش یک رکورد `letter_audit_log` با `action='edited'` ثبت می‌کنه. هر مشاهده هم یک رکورد `action='viewed'` ثبت می‌کنه.

## بک‌اند

مدل‌های Prisma جدید: `Letter`, `Document`, `DocumentTag`, `LetterWorkflowLog`, `LetterAuditLog`, `LetterCounter` (جدول‌ها baseline؛ Migration جدید لازم نیست).

### دسترسی (کلیدهای جدید — ماژول `correspondence` هنوز در کاتالوگ نبود)

| کلید | توضیح | گروه‌های پیش‌فرض |
|---|---|---|
| `correspondence.view_own_department` | مشاهده نامه‌های واحد خودم | فروش، بازرگانی، مالی، مدیریت |
| `correspondence.view_all` | مشاهده همهٔ واحدها | مدیریت |
| `correspondence.create` | ثبت پیش‌نویس + ویرایش + آپلود سند | فروش، بازرگانی، مالی، مدیریت |
| `correspondence.register` | ثبت رسمی و صدور شماره | فروش، بازرگانی، مالی، مدیریت |
| `correspondence.refer` | ارجاع به کارشناس | فروش، بازرگانی، مالی، مدیریت |
| `correspondence.archive` | بایگانی / ثبت مراحل گردش کار | فروش، بازرگانی، مالی، مدیریت |
| `correspondence.delete` | حذف نامه | فقط مدیریت |

### Endpoints

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /letters` | `view_own_department` یا `view_all` | لیست + فیلتر type/status/department/query؛ بدون `view_all` خودکار به `department = گروه کاربر` محدود می‌شه |
| `POST /letters` | `create` | ثبت پیش‌نویس (بدون شماره) |
| `GET /letters/:id` | `view_own_department`/`view_all` | جزئیات + اسناد + گردش کار + Audit Log؛ هر فراخوانی یک `letter_audit_log(action='viewed')` ثبت می‌کنه |
| `PATCH /letters/:id` | `create` | ویرایش فیلدها؛ ثبت `letter_audit_log(action='edited')` |
| `DELETE /letters/:id` | `delete` | حذف کامل |
| `POST /letters/:id/register` | `register` | صدور شماره اتمیک (`letter_counters`) + `status→registered` + `letter_workflow_logs(action='registered')` |
| `POST /letters/:id/refer` | `refer` | `letter_workflow_logs(action='referred', referred_to_user_id)` |
| `POST /letters/:id/workflow` | `archive` | ثبت اقدام آزاد (`scanned`/`responded`/`approved`/`sent`/`archived`) — `sent`/`archived` وضعیت نامه رو هم به‌روز می‌کنن |
| `POST /letters/:id/documents` | `create` | افزودن سند (fileUrl از `/files` قبلاً آپلود شده) + دسته‌بندی + برچسب‌ها |
| `PATCH /documents/:id` | `create` | ویرایش دسته‌بندی/برچسب‌ها |
| `DELETE /documents/:id` | `create` | حذف سند |

**قوانین کسب‌وکاری:**
- دقیقاً یکی از (`sender_our_entity_id`, `sender_partner_id`) و دقیقاً یکی از (`receiver_our_entity_id`, `receiver_partner_id`) باید پر باشه (اعتبارسنجی اپلیکیشن)
- `issuing_entity_id` پیش‌فرض همون طرفی که «شرکت ما»ست (فرستنده یا گیرنده)؛ قابل انتخاب دستی چون ممکنه با فرستنده/گیرنده یکی نباشه
- `department` از یکی از ۴ مقدار گروه پیش‌فرض (فروش/بازرگانی/مالی/مدیریت) — Select، نه متن آزاد
- ثبت رسمی فقط از `status='draft'` مجازه؛ تکرار → ۴۰۰

## فرانت‌اند

- صفحه جدید `/correspondence` (خارج از Placeholder) — لیست + جست‌وجو + فیلتر (نوع/وضعیت/واحد) + دکمه «نامه جدید»
- فرم نامه جدید: نوع/واحد/اولویت/شرکت شماره‌گذاری‌کننده (پیش‌نمایش شماره زنده) + `PartySelector` فرستنده/گیرنده (شرکت ما یا طرف بیرونی + رابط اختیاری) + لینک اختیاری به استعلام/محموله
- جزئیات نامه: کارت اصلی + اکشن‌های گردش کار + بخش‌های Collapsible (اسناد پیوست با آپلود+دسته‌بندی+برچسب، گردش کار، Audit Log)
- گیت دسترسی هرکدوم بر اساس کلید مربوطه

## خارج از اسکوپ فاز ۱۳ (به‌صراحت)

- یادآور/مهلت پاسخ + اعلان خودکار ارجاع — دامنه ۹
- سند مستقل بدون نامه رسمی
- OCR متن اسناد

## تست‌ها

- **Jest**: شماره‌گذاری اتمیک با سال شمسی/میلادی بر اساس `calendar_type`؛ رد ثبت رسمی دوباره؛ فیلتر دسترسی بر اساس واحد (بدون `view_all`)؛ ثبت خودکار Audit Log (viewed/edited)
- **E2E زنده**: ساخت نامه دریافتی از یک تأمین‌کننده به شرکت گروه → ثبت رسمی (شماره واقعی) → آپلود سند + برچسب → ارجاع → بایگانی → بررسی Audit Log و گردش کار کامل

## Definition of Done

- [ ] کاتالوگ دسترسی `correspondence` + Seed گروه‌های پیش‌فرض
- [ ] CRUD کامل نامه + گردش کار + اسناد + Audit Log
- [ ] فیلتر دسترسی واحد کار می‌کنه
- [ ] صفحه `/correspondence` مطابق mockup (نسخهٔ اصلی) — خروج از Placeholder
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README
