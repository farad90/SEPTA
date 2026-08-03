# SPEC — فاز ۱۱: ماژول سراسری «مدیریت بارها» (استعلام حمل + پیگیری محموله/گمرک)

> پیش‌نیاز: فاز ۱۰ ✅ (پیگیری تولید + بسته‌بندی). مرجع بصری: `mockups/shipment-management-mockup.jsx`.
> طبق تصمیم شما، **بدون تقسیم به زیرفاز** — استعلام حمل و چرخه کامل ۶مرحله‌ای محموله با هم در یک فاز.
> در اختیار **فقط بازرگانی و مدیریت** (`shipping.manage_freight_rfq` / `shipping.manage_shipment` — هر دو کلید از قبل در کاتالوگ دسترسی هستن و از قبل فقط به این دو گروه داده شدن؛ فروش هیچ‌کدوم رو نداره، پس نیازی به تغییر seed نیست).

## هدف فاز ۱۱

یک صفحه سراسری جدید («مدیریت بارها»، مسیر `/shipments`، از قبل در نویگیشن به‌عنوان Placeholder موجوده) با دو تب:

1. **استعلام حمل**: انتخاب بسته‌های `ready_to_ship` از **هر پرونده‌ای** (Cross-Inquiry) + ارسال استعلام به شرکت حمل (ایمیل انگلیسی، مثل الگوی RFQ تأمین‌کننده) + ثبت پیشنهاد قیمت + انتخاب برنده → ساخت خودکار یک محموله (`Shipment`)
2. **بارها**: لیست محموله‌ها + جزئیات هرکدوم با Stepper ۶مرحله‌ای (`consolidating → in_transit → export_declared → iran_docs_sent → customs_declared → cleared`) و فرم/آپلود مدارک هر مرحله

## ⚠️ تصمیمات و رفع ابهام (بدون نیاز به سوال مجدد — طبق الگوهای تثبیت‌شده فازهای قبل)

1. **شماره‌گذاری اتمیک**: `freight_rfqs.rfq_number` (`FRT-YYYY-NNNN`) و `shipments.shipment_number` (`SHP-YYYY-NNNN`) — دقیقاً همون الگوی `RfqNumberService`/`rfq_counters` فاز ۴؛ دو جدول شمارنده جدید (`freight_rfq_counters`, `shipment_counters`) با Migration جدید (baseline دست نمی‌خوره).
2. **ارسال ایمیل واقعی**: mockup برای استعلام حمل هم پیش‌نمایش ایمیل انگلیسی نشون می‌ده — دقیقاً مثل الگوی تثبیت‌شده RFQ تأمین‌کننده (فاز ۴)، از همون `MailModule` (SMTP با Fallback) استفاده می‌شه، نه یک قانون جدید «فقط آپلود دستی» (اون تصمیم فاز ۶ فقط برای فایل پیشنهاد مالی/فنی بود، نه ایمیل RFQ).
3. **یک پیشنهاد به‌ازای هر استعلام حمل**: بر خلاف آفر تأمین‌کننده (که چند آفر مجاز بود)، فرم mockup برای هر RFQ حمل فقط یک فرم پیشنهاد inline نشون می‌ده → در سطح اپلیکیشن یک `freight_offer` به‌ازای هر `freight_rfq` (ثبت اول = Create، ثبت بعدی = بازنویسی همون رکورد).
4. **رفع یک Gap در mockup**: در `ShipmentDetail`، مرحله ۰ («تجمیع») هیچ دکمه پیشروی‌ای نداره (احتمالاً جا افتاده). یک دکمه «تکمیل تجمیع و رفتن به مرحله حمل» اضافه می‌شه تا چرخه واقعاً قابل پیشروی باشه.
5. **پیشروی مرحله = یک‌طرفه**: مطابق mockup (فقط دکمه‌های Forward، بدون هیچ راه بازگشت) — `stage` فقط رو به جلو حرکت می‌کنه، بدون امکان بازگشت (مثل قفل بسته‌بندی فاز ۱۰، نه مثل وضعیت آزاد پیگیری تولید).
6. **فیلدهای هر مرحله بعد از پیشروی**: mockup هیچ `disabled` روی اینپوت‌های `ShipmentDetail` نداره → فیلدهای هر مرحله همیشه قابل ویرایش می‌مونن (فقط خود `stage` غیرقابل‌بازگشته، نه محتوای فرم‌ها).
7. **دکمه‌های «ارسال {مدرک}»**: چون گیرنده/محتوای پویا مثل ایمیل RFQ ندارن (فقط آپلود یک فایل به سیستم داخلی ماست)، به‌صورت آپلود فایل (مثل الگوی همیشگی `uploadFile`) پیاده می‌شن، نه ارسال ایمیل واقعی — با این تفاوت که موفقیت آپلود، فیلد `file_url` مربوطه رو پر می‌کنه.
8. **معیار «بسته آماده برای استعلام حمل» (اولین Query واقعاً Cross-Inquiry پروژه)**: بسته‌ای که `status='ready_to_ship'` باشه **و** هنوز در هیچ `shipment_packages`ای (یعنی هیچ محموله نهایی‌شده‌ای) ثبت نشده باشه. بسته‌ای که در یک یا چند `freight_rfq_packages` (استعلام‌های هنوز بی‌نتیجه) هست ولی هنوز برنده نداره، **همچنان قابل انتخابه** — چون ممکنه هم‌زمان از چند شرکت حمل استعلام گرفته بشه (دقیقاً مثل mockup که دو کارت رقیب برای یک‌سری بسته نشون می‌ده).
9. **اعتبارسنجی انتخاب برنده**: اگه هر کدوم از بسته‌های این RFQ از طریق یک RFQ دیگه از قبل به یک محموله دیگه commit شده باشن، انتخاب برنده رد می‌شه (پیام روشن) — از تناقض داده جلوگیری می‌کنه.
10. **لاگ فعالیت Cross-Inquiry**: چون یک استعلام حمل/محموله می‌تونه هم‌زمان بسته‌های چند پرونده رو شامل بشه، رویدادهای مهم (ارسال RFQ، انتخاب برنده، پیشروی مرحله) در `inquiry_discussions` **همه پرونده‌های مرتبط** (از طریق بسته → PO → Order → Inquiry) ثبت می‌شن، نه فقط یکی — هم‌سو با یادداشت معماری «Cross-Cutting Concern» در `erp-database-design.md`.
11. **نویگیشن**: آیتم `shipments` در `nav-config.ts` از حالت Placeholder خارج می‌شه؛ چون `shipping.view` الان به فروش هم داده شده (برای تب داخل پرونده، فاز ۱۰) و این باعث نشتی دسترسی به این ماژول سراسری می‌شه، شرط نمایش این آیتم خاص به OR دو کلید `shipping.manage_freight_rfq`/`shipping.manage_shipment` تغییر می‌کنه (پشتیبانی از چند-کلیدی به `NavItem`/`AppShell` اضافه می‌شه؛ بقیه آیتم‌ها دست‌نخورده).

## بک‌اند

### Migration + Prisma
`0006_freight_shipment_counters`: دو جدول `freight_rfq_counters`, `shipment_counters` (همون الگوی `rfq_counters`). بقیه جداول (`freight_rfqs`, `freight_rfq_packages`, `freight_offers`, `shipments`, `shipment_packages`, `export_documents`, `export_document_attachments`, `import_documents`) در baseline موجودن — فقط مدل Prisma اضافه می‌شه.

مدل‌های جدید: `FreightRfq`, `FreightRfqPackage`, `FreightOffer`, `Shipment`, `ShipmentPackage`, `ExportDocument`, `ExportDocumentAttachment`, `ImportDocument`, `FreightRfqCounter`, `ShipmentCounter`.

### FreightModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /packages/ready-for-freight` | `shipping.manage_freight_rfq` | بسته‌های `ready_to_ship` و هنوز بدون محموله، از **همه پرونده‌ها** — شامل شماره بسته/ابعاد/وزن/محل pickup/شماره PO/تأمین‌کننده/شماره و موضوع پرونده |
| `GET /freight-rfqs` | `shipping.manage_freight_rfq` | لیست کامل با بسته‌ها + پیشنهاد (در صورت وجود) + `wonByShipmentId` محاسبه‌شده |
| `POST /freight-rfqs` | `shipping.manage_freight_rfq` | ساخت + ارسال ایمیل — `{freightCompanyId, destinationCustoms, emailSubject?, packageIds[], recipientEmail}` |
| `GET /freight-rfqs/:id/email-preview` | `shipping.manage_freight_rfq` | پیش‌نمایش HTML/متن انگلیسی (جدول بسته‌ها + گمرک مقصد) |
| `POST /freight-rfqs/:id/resend` | `shipping.manage_freight_rfq` | ارسال مجدد |
| `PUT /freight-rfqs/:id/offer` | `shipping.manage_freight_rfq` | ثبت/بازنویسی پیشنهاد قیمت (`price, currencyCode, transitTimeDays, offerDate, validityDate, notes`) → `status → offer_received` |
| `POST /freight-rfqs/:id/select-winner` | `shipping.manage_freight_rfq` | می‌سازه `Shipment` (stage=`consolidating`) + `shipment_packages` از بسته‌های این RFQ؛ رد می‌شه اگه بسته‌ای قبلاً commit شده باشه |

### ShipmentModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /shipments` | `shipping.manage_shipment` | لیست خلاصه (شماره، شرکت حمل، گمرک مقصد، مرحله فعلی، تعداد بسته) |
| `GET /shipments/:id` | `shipping.manage_shipment` | جزئیات کامل + `exportDocuments`/`importDocuments` (خودکار seed در اولین GET، مثل الگوی `ProductionTracking`) |
| `PATCH /shipments/:id` | `shipping.manage_shipment` | فیلدهای سطح خود Shipment (بارنامه، تاریخ بارگیری، ETA، شماره/فایل اظهارنامه صادرات، شماره/فایل اظهارنامه گمرکی، هزینه‌های ترخیص، فایل‌های پایانی) |
| `PATCH /shipments/:id/export-documents` | `shipping.manage_shipment` | ۴ فیلد Invoice/Packing List/Non-Dual-Use/POA + `status` |
| `PATCH /shipments/:id/import-documents` | `shipping.manage_shipment` | فیلدهای «مدارک سمت ایران» (۱۱ فایل + ۴ شماره/تاریخ) |
| `POST /shipments/:id/advance` | `shipping.manage_shipment` | پیشروی یک‌طرفه به مرحله بعدی (به‌ترتیب ثابت STAGE_ORDER)؛ ۴۰۰ اگه در آخرین مرحله باشه |

**قوانین کسب‌وکاری:**
- `commercial_expert_id` همیشه کاربر لاگین‌شده
- بسته‌بندی برای استعلام حمل فقط وقتی مجازه که `package.status='ready_to_ship'` و هنوز در `shipment_packages` نباشه
- انتخاب برنده اتمیک (Transaction): ساخت Shipment + `shipment_packages` + شمارنده Shipment
- `stage` پیشروی یک‌طرفه؛ فیلدهای فرم هر مرحله همیشه آزادانه قابل ویرایش (حتی بعد از عبور از اون مرحله)
- `export_documents`/`import_documents` یک‌به‌یک با هر Shipment، Seed خودکار در اولین GET

## فرانت‌اند

- صفحه جدید `/shipments` (`ShipmentManagementPage`) — دو تب per mockup: «استعلام حمل» / «بارها»
- **تب استعلام حمل**: چک‌باکس‌لیست بسته‌های آماده (Cross-Inquiry) + فرم گمرک مقصد/جست‌وجوی شرکت حمل (فیلتر `partnerType=freight_forwarder`) + مودال پیش‌نمایش ایمیل + دکمه ارسال؛ زیرش لیست `FreightRfqCard`های collapsible (بج وضعیت، چیپ بسته‌ها، فرم ثبت پیشنهاد، دکمه «انتخاب این شرکت حمل به‌عنوان برنده» با تأیید)
- **تب بارها**: لیست محموله‌ها → کلیک → `ShipmentDetail` با Stepper ۶پله‌ای؛ هر مرحله بخش خودش (فیلدها + دکمه‌های آپلود مدارک با آیکون Send) + دکمه پیشروی به مرحله بعد؛ مرحله ۵ («ترخیص») با پیام پایانی سبز مطابق mockup
- گیت دسترسی سطح صفحه: بدون `shipping.manage_freight_rfq` تب اول مخفی/read-only، بدون `shipping.manage_shipment` تب دوم مخفی/read-only

## خارج از اسکوپ فاز ۱۱ (به‌صراحت)

- «دریافت کالا در انبار» (`warehouse_receipts`) — طبق یادداشت مرحله ۵ mockup، در صفحه خود پرونده و توسط فروش، فاز جداگانه بعدی
- `vessel_or_flight`, `origin_port`, `destination_port` — در schema هست ولی mockup برای این‌ها UI نداره؛ بدون فیلد در این فاز
- `consolidation_warehouse` — schema داره ولی mockup هیچ‌جا ورودی‌اش رو نشون نمی‌ده؛ خالی می‌مونه (بعداً در صورت نیاز)
- بستن/لغو خودکار سایر RFQهای رقیب بعد از انتخاب برنده — mockup هم این رفتار رو نداره

## تست‌ها

- **Jest**: تولید اتمیک شماره RFQ/Shipment؛ رد انتخاب برنده وقتی بسته قبلاً commit شده؛ پیشروی یک‌طرفه مرحله (رد تلاش برای رفتن عقب یا پرش)؛ Seed خودکار export/import documents
- **E2E زنده**: دو پرونده مختلف → هرکدوم یک PO با بسته `ready_to_ship` → `GET ready-for-freight` هر دو بسته رو برمی‌گردونه → ساخت یک `freight_rfq` با هر دو بسته → ثبت پیشنهاد → انتخاب برنده → `GET ready-for-freight` دیگه اون بسته‌ها رو برنمی‌گردونه → پیشروی محموله در ۶ مرحله با ثبت فیلدهای هر مرحله → پاک‌سازی

## Definition of Done

- [ ] Migration `0006_freight_shipment_counters` + همه مدل‌های Prisma دامنه ۶ (بخش دوم)
- [ ] FreightModule کامل (RFQ + ایمیل + پیشنهاد + انتخاب برنده)
- [ ] ShipmentModule کامل (۶ مرحله + export/import documents)
- [ ] `nav-config`/`AppShell` پشتیبانی چندکلیدی + صفحه `/shipments` واقعی (خروج از Placeholder)
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README
