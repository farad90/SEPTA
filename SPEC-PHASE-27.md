# SPEC — فاز ۲۷: محموله‌ها — اسناد چندفایلی، قفل مرحله، درخواست اصلاح با تأیید

## هدف

سه بهبود مرتبط روی ماژول پیگیری محموله (`apps/api/src/shipments/*`, `apps/web/src/pages/shipments/ShipmentDetail.tsx`):

1. **اسناد چندفایلی با تاریخچه** — هر جایگاه سند (Invoice، بارنامه، قبض انبار و...) به‌جای یک `*_file_url` تک‌فایله، لیستی از فایل‌ها می‌گیره
2. **قفل مرحله** — بعد از عبور از هر مرحلهٔ چرخهٔ ۶مرحله‌ای، فیلدها و اسناد اون مرحله قفل می‌شن (الان همه‌چیز برای همیشه آزاده)
3. **درخواست اصلاح + تأیید از طریق اعلان** — کارشناس برای ویرایش مرحلهٔ قفل‌شده درخواست می‌ده؛ مدیر از داخل خود اعلان (دکمه‌های تأیید/رد — اولین پیاده‌سازی واقعی `notifications.actions` طبق طراحی دامنه ۹) تصمیم می‌گیره

## وضعیت فعلی (خلاصه اکتشاف)

- چرخهٔ ۶مرحله‌ای (`consolidating → in_transit → export_declared → iran_docs_sent → customs_declared → cleared`) یک‌طرفه‌ست ولی طبق کامنت صریح کد فعلی، «فیلدهای فرم هر مرحله همیشه آزادانه قابل ویرایش می‌مونن» — هیچ قفلی وجود نداره.
- ۱۷ جایگاه سند تک‌فایله پراکنده در سه جدول: `shipments` (اظهارنامه صادرات، اظهارنامه گمرکی، قبض باسکول، بارنامه خروج)، `export_documents` (Invoice، Packing List، عدم کاربرد دوگانه، وکالت‌نامه)، `import_documents` (۹ سند مدارک ایران). آپلود جدید، فایل قبلی رو بی‌بازگشت جایگزین می‌کنه.
- `notifications.actions` (JSONB) و `is_actioned`/`actioned_at` از دامنه ۹ در DB هستن ولی هرگز پر نشدن؛ `NotificationBell` فقط عنوان/متن نشون می‌ده. Endpoint عمومی `recordAction` از قبل هست.
- پرمیژن‌های ماژول shipping: `view`, `record_packaging`, `manage_freight_rfq`, `manage_shipment`, `record_warehouse_receipt` — کلید تأیید/approval وجود نداره.

## تصمیمات طراحی

### ۱. اسناد چندفایلی — جدول عمومی جدید (تصمیم کاربر: چند فایل + تاریخچه کامل)

```sql
CREATE TABLE shipment_documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id  UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    doc_key      VARCHAR(50) NOT NULL,   -- کلید جایگاه: 'export_invoice', 'bill_of_lading', ...
    file_url     TEXT NOT NULL,
    file_name    VARCHAR(300),
    uploaded_by  UUID REFERENCES users(id),
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipment_documents_shipment ON shipment_documents(shipment_id, doc_key);
```

- **۱۷ کلید جایگاه** (هرکدوم به مرحلهٔ خودش نگاشت می‌شه): `export_invoice`, `export_packing_list`, `non_dual_use`, `power_of_attorney` (مرحله in_transit)؛ `export_declaration` (export_declared)؛ `import_invoice`, `import_packing_list`, `bill_of_lading`, `warehouse_slip`, `clearance_permit`, `freight_invoice_rial`, `freight_invoice_forex`, `inspection_certificate`, `certificate_of_origin` (iran_docs_sent)؛ `customs_declaration` (customs_declared)؛ `weighbridge_slip`, `customs_exit_waybill` (cleared).
- هر جایگاه می‌تونه چند فایل هم‌زمان داشته باشه؛ آپلود جدید **اضافه** می‌شه نه جایگزین؛ حذف فایل فقط تا وقتی مرحلهٔ مربوطه قفل نشده مجازه.
- **Migration داده**: مقادیر غیرخالی ۱۷ ستون تک‌فایلهٔ موجود به `shipment_documents` منتقل می‌شن (به‌عنوان اولین فایل هر جایگاه). ستون‌های قدیمی **دست‌نخورده باقی می‌مونن** (Deprecated — دیگه نه خونده می‌شن نه نوشته؛ فقط برای Rollback و سازگاری تاریخی) — الگوی افزودنی همیشگی پروژه.
- منطق `status='complete'` مدارک صادراتی از این به بعد «هر ۴ جایگاه صادراتی حداقل یک فایل دارن» چک می‌شه (از جدول جدید).
- Endpoint ها: `POST /shipments/:id/documents` (بدنه `{docKey, fileUrl, fileName?}`) و `DELETE /shipment-documents/:docId` — هر دو زیر `shipping.manage_shipment` + گارد قفل مرحله.
- جدول `export_document_attachments` موجود (مدارک آزاد صادراتی) دست‌نخورده می‌مونه — این فاز فقط جایگاه‌های تعریف‌شده رو عمومی می‌کنه.

### ۲. قفل مرحله

- **قانون قفل**: هر مرحله با ایندکس کوچکتر از مرحلهٔ فعلی محموله «قفل‌شده» است. مرحلهٔ فعلی و فیلدهاش آزادن. (چرخه یک‌طرفه‌ست، پس عبور = قفل.)
- **نگاشت فیلد→مرحله** در سرویس: `billOfLadingNumber`/`loadingDate`/`eta` + ۴ سند صادراتی + mark-sent → `in_transit`؛ `exportDeclarationNumber` + سندش → `export_declared`؛ همهٔ فیلدها و اسناد `import_documents` → `iran_docs_sent`؛ `customsDeclarationNumber` + سندش → `customs_declared`؛ هزینه‌ها/ترخیص‌کار + ۲ سند پایانی → `cleared`.
- **اجرا در بک‌اند** (نه فقط UI): `update()`/`updateExportDocuments()`/`updateImportDocuments()`/`addDocument()`/`removeDocument()` هر فیلد/سند متعلق به مرحلهٔ قفل‌شده رو با `BadRequestException` رد می‌کنن، مگر اینکه (الف) کاربر پرمیژن جدید `shipping.approve_edit` داشته باشه، یا (ب) اون مرحله موقتاً باز شده باشه (`unlocked_stage`، پایین).
- ⚠️ تصمیم کاربر: دارندهٔ `shipping.approve_edit` (پیش‌فرض فقط گروه مدیریت) **مستقیم و بدون درخواست** می‌تونه مراحل قفل‌شده رو ویرایش کنه؛ کارشناس بازرگانی عادی (`shipping.manage_shipment`) باید درخواست اصلاح بده.
- ستون جدید `shipments.unlocked_stage VARCHAR(30)` (nullable): مرحله‌ای که با تأیید درخواست، موقتاً باز شده — هم‌زمان حداکثر یک مرحله در هر محموله.

### ۳. درخواست اصلاح + تأیید از طریق اعلان

```sql
CREATE TABLE shipment_edit_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id   UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    stage         VARCHAR(30) NOT NULL,   -- مرحلهٔ قفل‌شده‌ای که درخواست بازشدنش داده شده
    reason        TEXT NOT NULL,          -- دلیل درخواست (الزامی)
    requested_by  UUID NOT NULL REFERENCES users(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by    UUID REFERENCES users(id),
    decided_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**گردش کار:**
1. کارشناس روی مرحلهٔ قفل‌شده «درخواست اصلاح» می‌زنه (مودال با textarea دلیل الزامی) → `POST /shipments/:id/edit-requests` — اگه درخواست pending دیگه‌ای برای همون محموله باشه رد می‌شه (جلوگیری از تلنبار).
2. برای همهٔ کاربران دارای `shipping.approve_edit` یک اعلان ساخته می‌شه — **اولین اعلان با `actions` پرشده**: `[{"label":"تأیید","action":"approve"},{"label":"رد","action":"reject"}]`، با `relatedEntityType='shipment_edit_request'` و `relatedEntityId` = شناسهٔ درخواست. `NotificationsService.create()` پارامتر اختیاری `actions` می‌گیره (تغییر افزودنی، بقیهٔ فراخوانی‌ها دست‌نخورده).
3. `POST /shipment-edit-requests/:id/approve` و `/reject` (گارد `shipping.approve_edit`): وضعیت درخواست + `decided_by/decided_at` ست می‌شه؛ در حالت تأیید، `shipments.unlocked_stage` = همون مرحله؛ به درخواست‌دهنده اعلان نتیجه (type `shipment_edit_decided`) می‌ره؛ یک رکورد activity هم در فید پرونده‌های درگیر ثبت می‌شه (الگوی موجود `logToInvolvedInquiries`).
4. ⚠️ تصمیم کاربر — **بازقفل‌شدن با دکمهٔ «پایان اصلاح»**: بعد از انجام ویرایش‌ها، درخواست‌دهنده (یا هر دارندهٔ `approve_edit`) دکمهٔ «پایان اصلاح» رو می‌زنه → `POST /shipments/:id/relock` → `unlocked_stage = null` + ثبت activity.
5. **فرانت‌اند NotificationBell**: برای اعلان‌های دارای `actions` غیرخالی و `!isActioned`، دکمه‌ها rendered می‌شن؛ کلیک → فراخوانی endpoint مربوطه (نگاشت `action` بر اساس `relatedEntityType`) سپس `recordAction` موجود؛ بعدش دکمه‌ها با برچسب «اقدام شد» جایگزین می‌شن. پیاده‌سازی generic نگه داشته می‌شه تا انواع بعدی اعلان قابل‌اقدام فقط یک entry به نگاشت اضافه کنن.

**پرمیژن جدید:** `shipping.approve_edit` — «تأیید درخواست اصلاح مراحل قفل‌شدهٔ محموله» — پیش‌فرض فقط گروه مدیریت (که خودکار `ALL_PERMISSION_KEYS` رو داره؛ به گروه بازرگانی داده **نمی‌شه**).

### فرانت‌اند (ShipmentDetail.tsx)

- `DocButton` تک‌فایله → کامپوننت جدید `DocSlot`: لیست فایل‌های جایگاه (هرکدوم با `FileViewer` + دکمهٔ حذف وقتی قابل‌ویرایشه) + دکمهٔ «افزودن فایل».
- مراحل قفل‌شده: فیلدها/آپلودها disabled + نشان قفل کنار عنوان مرحله + دکمهٔ «درخواست اصلاح» (فقط برای کسی که `approve_edit` نداره)؛ اگه درخواست pending وجود داره، وضعیت «در انتظار تأیید» نمایش داده می‌شه.
- مرحلهٔ بازشده (`unlocked_stage`): بنر زرد «در حال اصلاح» + دکمهٔ «پایان اصلاح»؛ فیلدهاش موقتاً فعال.
- دارندهٔ `approve_edit`: مراحل قفل‌شده براش مستقیم قابل‌ویرایشه (بدون درخواست)، فقط نشان قفل دیده می‌شه.

Migration: `0016_shipment_documents_edit_requests` (افزودنی — جدول‌ها/ستون جدید + انتقال دادهٔ فایل‌های موجود؛ Rollback با DROP).

## خارج از محدودهٔ این فاز

- حذف ستون‌های تک‌فایلهٔ قدیمی (Deprecated می‌مونن)
- تعمیم قفل/درخواست اصلاح به ماژول‌های دیگه (بسته‌بندی، PO و...)
- چندفایلی‌کردن `export_document_attachments` آزاد (از قبل چندتاییه) یا اسناد سایر ماژول‌ها
- بازگشت به مرحلهٔ قبل در چرخه (همچنان یک‌طرفه)

## معیار پذیرش

- هر ۱۷ جایگاه سند چند فایل می‌پذیره؛ فایل‌های موجود قبلی بعد از Migration در UI دیده می‌شن؛ حذف فایل فقط در مرحلهٔ باز مجازه
- ویرایش فیلد/سند مرحلهٔ قفل‌شده توسط کارشناس عادی هم از UI غیرفعاله هم از API با 400 رد می‌شه؛ دارندهٔ `approve_edit` مستقیم می‌تونه
- ثبت درخواست اصلاح → اعلان با دکمه‌های تأیید/رد برای مدیر → تأیید = بازشدن همون مرحله + اعلان به درخواست‌دهنده → «پایان اصلاح» = قفل مجدد؛ رد = اعلان رد به درخواست‌دهنده
- تست‌های Jest: گارد قفل (فیلد هر مرحله)، مسیر approve/reject/relock، جلوگیری از درخواست pending تکراری، منطق complete مدارک صادراتی از جدول جدید
- Build + Lint هر دو اپ؛ E2E زنده (چرخهٔ کامل: آپلود چندفایل، advance، تلاش ویرایش قفل‌شده، درخواست، تأیید از اعلان، اصلاح، پایان اصلاح)؛ تأیید بصری
- به‌روزرسانی `erp-schema.sql`، `erp-database-design.md`، `README.md`
