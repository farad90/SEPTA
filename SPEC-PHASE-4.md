# SPEC — فاز ۴: تأمین (دامنه ۳) — RFQ و آفر تأمین‌کننده

> پیش‌نیاز: فازهای ۱ تا ۳ ✅ (همه روی دیتابیس زنده تست‌شده).
> مرجع بصری: تب «استعلام از تأمین‌کنندگان» در `mockups/inquiry-detail-mockup.jsx` (RFQCard + فرم RFQ جدید).

## هدف فاز ۴

1. **فعال شدن تب ۲ پرونده**: ساخت و ارسال RFQ (زیرمجموعه‌ای از اقلام + شرکت گروه ما + تأمین‌کننده + ایمیل)
2. **ثبت پاسخ تأمین‌کننده** — دو مسیر مطابق design doc:
   - «سوال فنی داشت» → وضعیت `technical_question` + درج خودکار در فید گفتگو با `source_rfq_id`
   - «پیشنهاد قیمت داد» → ثبت آفر کامل (قیمت/تحویل/مشخصات فنی هر قلم + VAT + سایر هزینه‌ها + پیوست)
3. **ارسال واقعی ایمیل RFQ با SMTP** (تصمیم شما) + پیش‌نمایش قبل از ارسال
4. **Job شبانه «بدون پاسخ»**: RFQ های `awaiting_response` که از `response_due_date` گذشتن → `no_response`
5. **Master Data شرکت‌های گروه** (`our_entities`): Seed چهار شرکت واقعی + endpoint خواندن برای فرم

## تصمیمات تأییدشده

| موضوع | تصمیم |
|---|---|
| مهلت پیش‌فرض پاسخ | **۷ روز** (env: `RFQ_RESPONSE_DUE_DAYS=7`) — هنگام ارسال هر RFQ قابل تغییر |
| ارسال ایمیل | **واقعی با SMTP** (nodemailer) |
| شماره RFQ | `RFQ-YYYY-NNNN` میلادی، شمارنده سالانه اتمیک (همون الگوی استعلام) |

## طراحی ایمیل (جزئیات تصمیم SMTP — نیازمند نگاه شما)

- تنظیمات در env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (مثلاً `rfq@poulad-tajhiz.com`)
- **From** = آدرس سیستمی (`SMTP_FROM`) — **Reply-To** = ایمیل کارشناس بازرگانی ارسال‌کننده، تا پاسخ تأمین‌کننده مستقیم به صندوق خودش برگرده. CC هم به خود کارشناس.
- گیرنده: ایمیل شرکت تأمین‌کننده (`business_partners.email`) یا انتخاب از رابطین اون شرکت — در فرم قابل انتخاب/ویرایشه
- بدنه ایمیل **به انگلیسی** (طرف خارجی): موضوع = `email_subject` (پیش‌فرض شماره داخلی استعلام)، جدول اقلام (کد/شرح/مقدار/واحد + Part No/سازنده در صورت وجود)، امضا با نام شرکت گروهِ انتخابی (`our_entities.entity_name`)
- **Fallback**: اگر متغیرهای SMTP تنظیم نشده باشن، «ارسال RFQ» همچنان RFQ رو ثبت می‌کنه ولی با هشدار «ایمیل ارسال نشد — SMTP پیکربندی نشده؛ متن ایمیل رو کپی و دستی ارسال کن» + دکمه کپی متن. یعنی سیستم بدون SMTP هم قابل استفاده می‌مونه.
- خطای SMTP هنگام ارسال: RFQ ثبت می‌شه، خطا به کاربر گزارش می‌شه + امکان «ارسال مجدد ایمیل» از روی کارت RFQ

## Migration جدید: `0004_rfq_counters`

```sql
CREATE TABLE rfq_counters (
    year        INTEGER PRIMARY KEY,
    last_serial INTEGER NOT NULL DEFAULT 0
);
```

(erp-schema.sql مثل همیشه دست‌نخورده. جدول‌های دامنه ۳ همه در baseline موجودن.)

## بک‌اند

### مدل‌های Prisma جدید
`OurEntity`, `SupplierRfq`, `RfqItem`, `SupplierOffer`, `SupplierOfferItem`, `SupplierOfferDocument`, `RfqCounter` + وصل کردن اسکالر `inquiry_items.selected_offer_item_id` به relation واقعی (جدولش حالا مدل داره) و `inquiry_discussions.source_rfq_id` به `SupplierRfq`.

### Seed — شرکت‌های گروه (design doc، دامنه ۱ و ۸)

| entity_name | short_code | calendar | country |
|---|---|---|---|
| پولاد تجهیز آپادانا | پ ت | jalali | ایران |
| General Trading srl | GT | gregorian | Italy |
| Landa Controls | LC | gregorian | — (در فرم تعریف می‌شه؛ seed اولیه Italy/Turkey طبق اطلاع شما قابل اصلاحه) |
| Pasifik Global Makina | PGM | gregorian | Turkey |

### MailModule (زیرساخت مشترک — بعداً مکاتبات/اعلان هم استفاده می‌کنن)
- `MailService.send({to, subject, html, replyTo, cc})` با nodemailer؛ `isConfigured()` برای Fallback

### RfqsModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /our-entities` | هر کاربر لاگین | لیست فعال‌ها برای dropdown فرم |
| `GET /inquiries/:id/rfqs` | `rfq.view` | RFQ های یک پرونده + آفرها |
| `POST /inquiries/:id/rfqs` | `rfq.send` | ساخت + شماره اتمیک + ارسال ایمیل + activity «RFQ به X ارسال شد» |
| `GET /rfqs/:id/email-preview` | `rfq.view` | خروجی HTML/متن ایمیل (برای پیش‌نمایش و کپی) |
| `POST /rfqs/:id/resend-email` | `rfq.send` | ارسال مجدد در صورت خطای SMTP |
| `PATCH /rfqs/:id/status` | `rfq.record_offer` | بازگشت دستی از `no_response` به `awaiting_response` (پاسخ دیرهنگام) |
| `POST /rfqs/:id/technical-question` | `rfq.record_offer` | وضعیت → `technical_question` + درج در `inquiry_discussions` (tag=`technical_question`, `source_rfq_id`, mention اختیاری کارشناس فروش پرونده) |
| `POST /rfqs/:id/offers` | `rfq.record_offer` | ثبت آفر + اقلام + `received_at` خودکار سرور + وضعیت → `offer_received` + activity |
| `PATCH /supplier-offers/:id` | `rfq.record_offer` | اصلاح آفر (تا قبل از قفل انتخاب نهایی — چک `selection_locked_at`) |
| `POST /supplier-offers/:id/documents` | `rfq.record_offer` | پیوست فایل آفر (FilesModule فاز ۳) |

**قوانین کسب‌وکاری:**
- تأمین‌کننده باید `partner_type IN ('supplier','both')` باشه
- اقلام RFQ باید متعلق به همون inquiry باشن؛ حداقل ۱ قلم
- `email_subject` پیش‌فرض = `inquiries.internal_number`
- هر قلم فقط یک‌بار در هر آفر (`UNIQUE(offer_id, inquiry_item_id)`) — اقلام آفر باید زیرمجموعه اقلام همون RFQ باشن
- جمع پیش‌فاکتور (کالا + VAT + سایر) **محاسبه‌شده در پاسخ API**، نه ستون ذخیره‌شده (طبق design doc)
- بعد از `selection_locked_at` پرونده، ثبت/ویرایش آفر مسدود می‌شه

### Cron Job (پاسخ به سوال باز design doc)
`@nestjs/schedule` — هر شب ۰۲:۰۰: RFQ های `awaiting_response` با `response_due_date < today` → `no_response` + activity در پرونده.

## فرانت‌اند — تب ۲ پرونده (`/inquiries/:id`)

مطابق mockup:

1. **فرم RFQ جدید** (با `rfq.send`): چک‌باکس انتخاب اقلام، select «شرکت ما» (accent، از `/our-entities`)، autocomplete تأمین‌کننده (فقط supplier/both)، گیرنده ایمیل (ایمیل شرکت یا رابط)، عنوان ایمیل (پیش‌فرض شماره داخلی)، مهلت پاسخ (پیش‌فرض امروز+۷ شمسی)، دکمه «پیش‌نمایش ایمیل» (مودال + کپی متن) و «ارسال RFQ»
2. **لیست RFQ های ارسالی**: کارت بازشونده — تأمین‌کننده، شرکت ما، تاریخ ارسال (شمسی)، StatusBadge چهار وضعیت (در انتظار/بدون پاسخ/سوال فنی/آفر ثبت شد)
3. **ثبت پاسخ روی کارت** (با `rfq.record_offer`): انتخاب مسیر «سوال فنی» (textarea → درج در فید) یا «پیشنهاد قیمت»: فرم کامل آفر — شماره/تاریخ سند آفر، ارز (از `/currencies`... ارزها در baseline seed شدن؛ endpoint سبک `GET /currencies` هم اضافه می‌شه)، شخص آفردهنده، ردیف هر قلم (قیمت/تحویل/PartNumber/مشخصات فنی/معادل/کشور سازنده)، VAT + درصد، سایر هزینه‌ها، ملاحظات کلی، **جمع زنده پیش‌فاکتور**، پیوست فایل آفر، ثبت با `received_at` خودکار (پیام mockup: «تاریخ دریافت نیازی به ورود نداره»)
4. آفر ثبت‌شده قفل نمایش داده می‌شه + دکمه «اصلاح» (تا قبل از قفل انتخاب نهایی)
5. تب ۲ در نوار مراحل باز می‌شه؛ نشانگر تعداد RFQ/وضعیت روی تب
6. «خروجی اکسل اقلام»: خروجی CSV سمت کلاینت (قابل باز شدن در Excel) — xlsx واقعی اگه لازم شد فاز بعد

## خارج از اسکوپ فاز ۴ (به‌صراحت)

- تب ۳ (انتخاب نهایی و قیمت‌گذاری/مقایسه آفرها) — فاز ۵؛ `distribute_costs` هم مال همون مرحله‌ست
- پنل مدیریتی `our_entities` (طبق design doc فاز آینده) — فقط seed + read
- گزارش «میانگین سرعت پاسخ‌دهی تأمین‌کننده» (داده‌ش با `received_at` جمع می‌شه؛ گزارش در فاز گزارش‌ها)
- دریافت خودکار نرخ ارز (`exchange_rates.source` — سوال باز ۱ design doc)

## تست‌ها

- **Jest**: قوانین RFQ (تأمین‌کننده غلط، قلم خارج از پرونده)، مسیر سوال فنی (درج discussion با source_rfq_id)، ثبت آفر (received_at خودکار، وضعیت، محاسبه جمع)، قفل بعد از selection_locked_at، Fallback ایمیل بدون SMTP، منطق Job بدون‌پاسخ
- **E2E روی DB زنده**: ساخت RFQ (بدون SMTP واقعی → مسیر Fallback) → سوال فنی → آفر کامل با پیوست → بررسی فید و وضعیت‌ها → پاک‌سازی

## Definition of Done فاز ۴

- [ ] `0004_rfq_counters` + seed چهار شرکت گروه اعمال‌شده
- [ ] ساخت RFQ با شماره متوالی `RFQ-2026-NNNN` و ایمیل (یا Fallback تمیز بدون SMTP)
- [ ] هر دو مسیر پاسخ کارکردی؛ سوال فنی در فید پرونده با ارجاع به RFQ ظاهر می‌شه
- [ ] آفر با جمع زنده، `received_at` خودکار و پیوست ثبت می‌شه
- [ ] Job شبانه no_response + بازگشت دستی
- [ ] تب ۲ مطابق mockup فعال؛ تب‌های ۳ به بعد همچنان قفل
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری
