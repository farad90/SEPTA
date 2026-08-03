# SPEC — فاز ۳: ماژول استعلام (دامنه ۲)

> پیش‌نیاز: فاز ۱ (Auth/RBAC) و فاز ۲ (App Shell + شرکت‌ها + کاتالوگ + کاربران) — هر دو ✅ و روی دیتابیس واقعی تست‌شده.

## هدف فاز ۳

1. **لیست استعلام‌ها** (`/inquiries`) مطابق `mockups/inquiry-list-mockup.jsx` — فیلتر/جستجو/سورت
2. **فرم ثبت/ویرایش استعلام** مطابق `mockups/inquiry-form-mockup.jsx` — شامل اقلام، انتخاب کد کالا با autocomplete و «افزودن سریع به کاتالوگ»
3. **صفحه جزئیات پرونده** (`/inquiries/:id`) مطابق `mockups/inquiry-detail-mockup.jsx` — نوار ۹ تب کامل رندر می‌شه ولی فقط تب «ثبت استعلام» + فید «گفتگو/فعالیت» فعاله؛ بقیه تب‌ها Placeholder فازهای ۴ به بعد
4. **آپلود مستندات هر قلم** (نقشه/کاتالوگ) — زیرساخت ذخیره فایل که مبنای همه فازهای بعدی می‌شه
5. **فید گفتگو + لاگ فعالیت خودکار** (`inquiry_discussions`) — سرویس Cross-Cutting که فازهای بعد هم استفاده می‌کنن

## تصمیمات تأییدشده

| موضوع | تصمیم |
|---|---|
| ذخیره فایل | دیسک لوکال سرور (`uploads/`)، پشت لایه انتزاعی `StorageService` برای مهاجرت آتی به MinIO/S3 بدون تغییر ماژول‌ها |
| شماره داخلی | میلادی — `INQ-2026-0417`؛ اتمیک با جدول شمارنده (مشابه الگوی `letter_counters`) |
| تاریخ‌ها | DB همیشه Gregorian `DATE`؛ UI نمایش/ورود **شمسی** (کتابخانه `date-fns-jalali`) |

## Migration جدید: `0003_inquiry_counters`

`erp-schema.sql` برای استعلام شمارنده‌ای ندارد (فقط `internal_number UNIQUE`). برای تولید اتمیک بدون race:

```sql
CREATE TABLE inquiry_counters (
    year        INTEGER PRIMARY KEY,   -- سال میلادی
    last_serial INTEGER NOT NULL DEFAULT 0
);
```

تولید شماره در تراکنش با `SELECT ... FOR UPDATE` (همون قانونی که design doc برای letter_counters گذاشته). `erp-schema.sql` مثل همیشه دست‌نخورده می‌مونه.

## بک‌اند

### مدل‌های Prisma جدید (بدون تغییر جدول‌های baseline)

`Inquiry`, `InquiryItem`, `InquiryItemDocument`, `InquiryDiscussion`, `InquiryCounter` — منطبق بر `0001_baseline` + `0003`. ستون‌های فاز ۴ (`selected_offer_item_id`, `markup_percent`, ...) هم در مدل می‌آن (جدول‌شون هست) ولی API فاز ۳ بهشون دست نمی‌زنه.

### FilesModule — زیرساخت مشترک فایل

- `StorageService` (driver: local): ذخیره در `uploads/YYYY/MM/<uuid>-<safe-name>`؛ interface طوری که driver S3 بعداً جایگزین بشه
- `POST /files` (multipart, هر کاربر لاگین‌شده): آپلود → `{ fileUrl, fileName }` — ماژول‌ها فقط URL رو در جدول خودشون ثبت می‌کنن
- `GET /files/<path>`: دانلود **پشت JWT** (نه static عمومی) — چون نقشه‌های فنی مشتری محرمانه‌ان
- محدودیت: حداکثر ۲۰MB؛ فرمت‌های مجاز: pdf, png, jpg, webp, dwg, xlsx, docx, zip
- پوشه `uploads/` در `.gitignore` و volume در docker-compose

### InquiriesModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /inquiries` | `inquiry.view` | فیلتر: `status`, `buyerId`, `salesExpertId`, `q` (شماره/موضوع) + سورت (`deadline`, `createdAt`) + صفحه‌بندی |
| `POST /inquiries` | `inquiry.create` | Header + آرایه اقلام در یک تراکنش؛ تولید `internal_number`؛ activity «پرونده ثبت شد» |
| `GET /inquiries/:id` | `inquiry.view` | کامل: اقلام + مستندات + مشتری/رابط + کارشناس |
| `PATCH /inquiries/:id` | `inquiry.edit` | فیلدهای header؛ تغییر `status` → activity با `tag='status_change'` |
| `PATCH /inquiries/:id/assign` | `inquiry.assign` | تغییر `sales_expert_id` → activity |
| `DELETE /inquiries/:id` | `inquiry.delete` | حذف کامل (CASCADE اقلام/مستندات/گفتگو) |
| `POST /inquiries/:id/items` | `inquiry.edit` | قلم جدید؛ `row_index` = max+1 |
| `PATCH /inquiry-items/:itemId` | `inquiry.edit` | |
| `DELETE /inquiry-items/:itemId` | `inquiry.edit` | `row_index` بقیه دست نمی‌خوره (پایداری ارجاع) |
| `POST /inquiry-items/:itemId/documents` | `inquiry.edit` | ثبت `file_url` آپلودشده + activity با `tag='file_upload'` |
| `DELETE /inquiry-item-documents/:id` | `inquiry.edit` | |
| `GET /inquiries/:id/discussions` | `inquiry.view` | ترکیبی message + activity، صعودی |
| `POST /inquiries/:id/discussions` | `inquiry.view` | پیام آزاد + `mentioned_user_id` اختیاری |

**قوانین کسب‌وکاری (سطح اپلیکیشن، طبق design doc):**
- `buyer_id` فقط partner با `partner_type IN ('customer','both')`
- `item_code` باید در کاتالوگ موجود باشه (FK هم هست) — فرم UI مسیر «افزودن سریع به کاتالوگ» داره (نیازمند `catalog.create`)
- `item_count` ذخیره نمی‌شه — `COUNT` در پاسخ لیست
- پیش‌فرض `sales_expert_id` = کاربر جاری؛ `created_by_user_id` همیشه = کاربر جاری

### ActivityLogService (Cross-Cutting — دامنه ۲ به بعد)

سرویس مشترک `logActivity(inquiryId, authorId, text, tag, metadata?, sourceRfqId?)` که رکورد `entry_type='activity'` درج می‌کنه. فاز ۳ فقط ماژول استعلام صداش می‌زنه؛ فازهای RFQ/انتخاب/پیشنهاد/... طبق design doc **باید** همین سرویس رو صدا بزنن (اقدامات مهم، نه هر تغییر جزئی).

## فرانت‌اند

### زیرساخت شمسی
- `date-fns-jalali`: توابع `formatJalali(isoDate)` و `parseJalali("۱۴۰۵/۰۴/۲۰")` در `lib/jalali.ts` (پشتیبانی ارقام فارسی/لاتین)
- کامپوننت `JalaliDateInput` — ورودی متنی با اعتبارسنجی و تبدیل به ISO برای API

### صفحات

| Route | مرجع بصری | نکات |
|---|---|---|
| `/inquiries` | inquiry-list-mockup | جدول با سورت‌هدر، StatusBadge (۶ وضعیت)، فیلتر وضعیت/مشتری/کارشناس + جستجو؛ ستون «ارزش» فعلاً «—» (از آفر منتخب فاز ۴ میاد)؛ کلیک ردیف → جزئیات |
| `/inquiries/new` و `/inquiries/:id/edit` | inquiry-form-mockup | SectionCardها: اطلاعات کلی (مشتری از partners نوع customer/both + رابط همون شرکت، مهلت‌ها شمسی، کانال/فوریت، تایپ معادل، تسویه/پیش‌پرداخت) + جدول اقلام (ItemCodeField با autocomplete از کاتالوگ + QuickAddCatalogModal) |
| `/inquiries/:id` | inquiry-detail-mockup | نوار ۹ تب (بقیه با قفل/Placeholder)، تب ثبت استعلام: view/edit header + اقلام + آپلود/حذف مستندات هر قلم؛ تب فعالیت: فید ترکیبی چت+activity با آیکون متمایز، ارسال پیام، Mention همکار (از `GET /users`)، تگ‌ها |

- آپلود با progress ساده (axios `onUploadProgress`)؛ دانلود مستندات با لینک توکن‌دار
- «واگذاری استعلام» (تغییر کارشناس مسئول) فقط با `inquiry.assign` نمایش داده می‌شه

## تست‌ها

- **Jest**: تولید شماره اتمیک (mock تراکنش)، قانون buyer_id (رد partner_type غلط)، ActivityLogService (درج با tag درست)، قوانین discussions
- **E2E دستی روی DB زنده** (اینجا قابل اجراست): ساخت استعلام کامل با اقلام → آپلود فایل → پیام + mention → تغییر وضعیت → بررسی فید activity

## خارج از اسکوپ فاز ۳ (به‌صراحت)

- تب‌های ۲ تا ۹ جزئیات پرونده (RFQ به بعد — فاز ۴+)
- ستون «ارزش» لیست (مشتق از آفر منتخب)، به‌روزرسانی خودکار `inquiries.status` از نتایج اقلام (فاز نتیجه)
- اعلان push برای mention (دامنه ۹ — فعلاً فقط ثبت در دیتابیس)
- OCR روی مستندات

## Definition of Done فاز ۳

- [ ] `0003_inquiry_counters` اجرا و تولید شماره هم‌زمان بدون تکرار
- [ ] CRUD کامل استعلام + اقلام با قوانین کسب‌وکاری، تست‌شده روی DB زنده
- [ ] آپلود/دانلود محافظت‌شده مستندات قلم (لوکال، پشت JWT)
- [ ] فید گفتگو/فعالیت: پیام + mention + activity خودکار (ثبت، تغییر وضعیت، آپلود، واگذاری)
- [ ] هر سه صفحه مطابق mockup با تاریخ شمسی
- [ ] سایدبار: «استعلام‌ها» از Placeholder به صفحه واقعی وصل می‌شه
- [ ] Jest سبز + build/lint هر دو اپ + تست بصری Preview
