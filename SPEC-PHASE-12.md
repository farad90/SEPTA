# SPEC — فاز ۱۲: دریافت کالا در انبار (تکمیل تب ۸) + تحویل و تسویه (تب ۹)

> پیش‌نیاز: فاز ۱۱ ✅ (ماژول مدیریت بارها — اکنون `shipments` وجود داره و بلاک فاز ۱۰ رفع شده).
> مرجع بصری: تکمیل `ShippingTab` (بخش «دریافت کالا در انبار» + کارت «وضعیت محموله») و کل `SettlementTab` در `mockups/inquiry-detail-mockup.jsx`.
> آخرین تب فرآیند سفارش — با این فاز، هر ۹ تب `PROCESS_TABS` فعال می‌شن.

## هدف فاز ۱۲

1. **تکمیل تب ۸ (حمل و گمرک)**: کارت فقط‌خواندنی «وضعیت محموله» هر PO + بخش «دریافت کالا در انبار» (مقدار دریافتی + تصاویر هر قلم، توسط فروش)
2. **تب ۹ (تحویل و تسویه)، دامنه ۷ کامل**: تحویل به مشتری + تایید فنی/کیفی → صدور فاکتور نهایی (به ریال، تفکیک‌شده با نرخ ارز جدا) → پیگیری وصول

## ⚠️ تصمیمات (شامل پاسخ‌های شما)

1. **دریافت انبار ↔ محموله**: طبق تصمیم شما، **تشخیص خودکار تک‌محموله**. سرور از طریق `Package → shipment_packages → Shipment` همهٔ محموله‌های `stage='cleared'` مرتبط با POهای این پرونده رو پیدا می‌کنه: صفر محموله → پیام «هنوز ترخیص نشده»؛ دقیقاً یکی → خودکار مبنای `warehouse_receipts` می‌شه؛ بیش از یکی → پیام روشن «این پرونده از چند محموله جدا تشکیل شده — این حالت پشتیبانی نمی‌شه» (خارج از اسکوپ).
2. **ردیف‌های فاکتور نهایی**: طبق تصمیم شما، **افزودن/ویرایش آزاد** (الگوی «ردیف خالی + ویرایش خطی» تثبیت‌شده) — نه تقسیم ثابت ۳۰/۷۰ mockup. هر ردیف اختیاری به یکی از `customer_payments` همون سفارش لینک می‌شه (فقط برای پرکردن خودکار اولیه شرح/مبلغ؛ کاملاً قابل ویرایش بعدی و مستقل از منبع).
3. **یک Delivery و یک Invoice به‌ازای هر سفارش** (هم‌سو با الگوی «یک Order به‌ازای هر پرونده» فاز ۸؛ mockup هم فقط یک بلوک تحویل/فاکتور نشون می‌ده، نه لیست).
4. **ذخیره‌سازی مستقل هر بخش** (نه یک دکمه واحد «ثبت اطلاعات تحویل و تسویه» مثل mockup) — هم‌سو با تصمیم تکرارشدهٔ فازهای ۶ تا ۹: تحویل با ذخیرهٔ خطی (onBlur)، فاکتور با دکمهٔ «صدور فاکتور» جدا، ردیف‌های فاکتور و وصولی هرکدوم مستقل ذخیره می‌شن.
5. **شماره فاکتور دستیه** (مطابق mockup — ورودی متنی آزاد، نه شمارندهٔ اتمیک) — چون فاکتور رسمی مالیاتی معمولاً از سامانهٔ بیرونی شماره می‌گیره.
6. **فیلدهای `warehouse_receipts` که در mockup نیستن** (`receipt_number`, `arrival_date`, `destination_warehouse`, `packaging_condition`) — طبق الگوی تثبیت‌شده (مثل `estimated_ready_date` فاز ۱۰)، خودکار پر می‌شن (`receipt_number` مشتق از شماره محموله، `arrival_date = امروز`) و در UI این فاز نمایش داده نمی‌شن.
7. **`invoice_collections.follow_up_notes` به‌جای شرح ردیف استفاده می‌شه** — چون این جدول (برخلاف mockup) ستون «شرح» نداره؛ برای استفادهٔ مجدد از `FlexPaymentList` (که به یک فیلد شرح نیاز داره)، `follow_up_notes` همون نقش رو ایفا می‌کنه.

## بک‌اند

مدل‌های Prisma جدید: `Delivery`, `Invoice`, `InvoiceItem`, `InvoiceCollection`, `WarehouseReceipt`, `WarehouseReceiptItem`, `WarehouseReceiptPhoto` (baseline؛ Migration جدید لازم نیست).

### تکمیل ShippingModule (تب ۸)

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /inquiries/:id/shipment-status` | `shipping.view` | فقط‌خواندنی — به‌ازای هر PO: شماره/تأمین‌کننده + شماره و مرحلهٔ محموله (در صورت وجود) |
| `GET /inquiries/:id/warehouse-receipt` | `shipping.record_warehouse_receipt` | تشخیص خودکار محمولهٔ ترخیص‌شده + Seed خودکار `warehouse_receipts` + لیست اقلام پرونده با مقدار دریافتی/تصاویر فعلی |
| `PUT /inquiries/:id/warehouse-receipt/items` | `shipping.record_warehouse_receipt` | ذخیرهٔ دسته‌ای مقدار دریافتی هر قلم (Upsert `warehouse_receipt_items`) |
| `POST /warehouse-receipt-items/:id/photos` | `shipping.record_warehouse_receipt` | افزودن تصویر به یک قلم دریافتی |

### SettlementModule (تب ۹)

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /inquiries/:id/delivery` | `settlement.record_delivery` | Seed خودکار (نیازمند وجود Order) |
| `PATCH /inquiries/:id/delivery` | `settlement.record_delivery` | تاریخ/روش تحویل، تحویل‌گیرنده، فایل رسید، تاریخ/وضعیت تایید مشتری |
| `GET /inquiries/:id/invoice` | `settlement.issue_invoice` | فاکتور (در صورت وجود) + اقلام + `orderTotal` مرجع (از سفارش/آخرین پیشنهاد مالی) |
| `PUT /inquiries/:id/invoice` | `settlement.issue_invoice` | صدور/ویرایش سرصفحهٔ فاکتور — فقط اگه `customerAcceptanceStatus='accepted'` |
| `POST /inquiries/:id/invoice/items` | `settlement.issue_invoice` | افزودن ردیف خالی (شرح/مبلغ/نرخ صفر، قابل ویرایش خطی) |
| `PATCH /invoice-items/:id` | `settlement.issue_invoice` | ویرایش ردیف — `amount_irr` سمت سرور بازمحاسبه می‌شه؛ `invoices.final_amount_irr` هم به‌روز می‌شه |
| `DELETE /invoice-items/:id` | `settlement.issue_invoice` | حذف ردیف + بازمحاسبهٔ جمع |
| `GET /inquiries/:id/invoice/collections` | `settlement.record_collection` | لیست وصولی (فقط بعد از وجود فاکتور) |
| `POST /inquiries/:id/invoice/collections` | `settlement.record_collection` | افزودن ردیف خالی |
| `PATCH /invoice-collections/:id` | `settlement.record_collection` | ویرایش ردیف |
| `DELETE /invoice-collections/:id` | `settlement.record_collection` | حذف ردیف |

**قوانین کسب‌وکاری:**
- صدور/ویرایش فاکتور فقط وقتی `customer_acceptance_status='accepted'` باشه (Business Rule سطح اپلیکیشن، طبق design doc)
- `invoices.final_amount_irr` همیشه از `SUM(invoice_items.amount_irr)` سرور محاسبه می‌شه، نه ورودی دستی
- نرخ ارز هر ردیف (`exchange_rate_value`) صرفاً دستی — بدون اتصال به `exchange_rates`
- شماره فاکتور یکتا؛ تلاش تکراری → ۴۰۹

### دسترسی
از کلیدهای موجود کاتالوگ استفاده می‌شه (بدون افزودن کلید جدید): `shipping.view`, `shipping.record_warehouse_receipt`, `settlement.record_delivery`, `settlement.issue_invoice`, `settlement.record_collection`. طبق design doc (دریافت انبار کار فروشه، نه بازرگانی)، `shipping.record_warehouse_receipt` باید به گروه پیش‌فرض **فروش** هم اضافه بشه (الان فقط `shipping.view`/`shipping.record_packaging` رو داشت) — اصلاح `permission-catalog.ts` + reseed.

## فرانت‌اند

- **تب ۸ تکمیل**: کارت «وضعیت محموله» فقط‌خواندنی بالای بخش انبار + بخش «دریافت کالا در انبار» (مقدار دریافتی هر قلم با onBlur + دکمهٔ آپلود تصویر هر قلم + گالری کوچک تصاویر ثبت‌شده)
- **تب ۹**: بلوک «تحویل به مشتری» (فیلدها + آپلود رسید + بخش تایید فنی/کیفی) → بلوک «فاکتور نهایی» (قفل با پیام mockup تا تایید نشده؛ سرصفحه + جدول ردیف‌های آزاد با نرخ دستی + جمع کل زنده) → `FlexPaymentList` برای پیگیری وصول
- گیت دسترسی هرکدوم بر اساس کلید مربوطه؛ بدون دسترسی → فرم‌ها read-only/مخفی

## خارج از اسکوپ فاز ۱۲

- حالتی که یک پرونده از **چند محموله جدا** (چند PO با محمولهٔ مجزا) تشکیل شده — پیام خطای روشن، بدون UI اختصاصی
- فیلدهای بی‌نمایش `warehouse_receipts` (شمارهٔ رسید/انبار مقصد/وضعیت بسته‌بندی) — schema-only

## تست‌ها

- **Jest**: تشخیص خودکار محموله (۰/۱/چند حالت) برای دریافت انبار؛ قفل بودن صدور فاکتور قبل از تایید مشتری؛ بازمحاسبهٔ `final_amount_irr` بعد از افزودن/ویرایش/حذف ردیف
- **E2E زنده**: مسیر کامل یک پرونده از فاز ۱۱ (تا `cleared`) → دریافت انبار (مقدار+تصویر) → تحویل به مشتری → تایید مشتری → صدور فاکتور → افزودن دو ردیف با نرخ متفاوت → وصولی → پاک‌سازی

## Definition of Done

- [ ] `GET shipment-status` + `warehouse-receipt` (خودکار seed تک‌محموله) + آپلود تصویر هر قلم
- [ ] `Delivery`/`Invoice`/`InvoiceItem`/`InvoiceCollection` کامل با قوانین قفل/بازمحاسبه
- [ ] `shipping.record_warehouse_receipt` به فروش هم اضافه شد (seed)
- [ ] تب ۸ تکمیل + تب ۹ کامل مطابق mockup با تصمیمات بالا
- [ ] Jest سبز + build/lint + E2E زنده + تست بصری + README (همهٔ ۹ تب ✅)
