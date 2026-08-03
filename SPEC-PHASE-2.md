# SPEC — فاز ۲: App Shell + داده پایه + مدیریت کاربران

> پیش‌نیاز: فاز ۱ (Scaffold + Migration + Auth/RBAC) — کدش کامله؛ فقط اجرای migration روی Postgres واقعی هنوز توسط شما انجام نشده.
> فازهای بعدی: استعلام (فاز ۳)، تأمین/RFQ (فاز ۴)، ...

## هدف فاز ۲

1. **App Shell**: سایدبار + تاپ‌بار مطابق `mockups/app-shell-mockup.jsx` — منوی فیلترشده بر اساس دسترسی‌های کاربر جاری
2. **شرکت‌ها و رابطین**: CRUD کامل مطابق `mockups/business-partner-management-mockup.jsx` + هشدار شباهت نام (pg_trgm)
3. **کاتالوگ کالا**: CRUD کامل مطابق `mockups/item-catalog-mockup.jsx` + هشدار شباهت کد
4. **کاربران و گروه‌های دسترسی**: UI کامل مطابق `mockups/user-role-management-mockup.jsx` — تأیید کاربر در انتظار، تخصیص/تغییر گروه، ساخت گروه سفارشی با چک‌باکس دسترسی‌ها
5. **Seed کامل کاتالوگ دسترسی‌ها**: ۱۱ ماژول / ~۳۵ کلید از mockup به‌عنوان مرجع نهایی

## 🐛 اصلاح ضروری (قبل از هر چیز): Extension گمشده

`0001_baseline.sql` دو ایندکس `gin_trgm_ops` می‌سازه ولی `erp-schema.sql` فقط `pgcrypto` رو نصب می‌کنه، نه `pg_trgm` — یعنی `prisma migrate deploy` روی دیتابیس تازه **شکست می‌خوره**. چون baseline باید عیناً دست‌نخورده بمونه، یک migration جدید `0000_extensions/migration.sql` (که به‌خاطر ترتیب الفبایی قبل از 0001 اجرا می‌شه) اضافه می‌شه:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

شما هنوز migration رو اجرا نکردید، پس این اصلاح قبل از اولین اجراست و دردسری نداره.

## تصمیم معماری: یکی‌سازی کلیدهای دسترسی

فاز ۱ سه کلید موقت seed کرده بود (`users.view_pending`, `users.approve`, `users.assign_permission_group`)، ولی mockup مرجع (`user-role-management-mockup.jsx`) برای ماژول users فقط **یک کلید** داره: `users.manage`. چون این mockup همون چیزیه که به‌عنوان چک‌باکس به مدیر نمایش داده می‌شه، باید کلید Enforcement بک‌اند و چک‌باکس UI یکی باشن — وگرنه گروهی که در UI تیک «مدیریت کاربران» داره، پشت API رد می‌شه.

- **کاتالوگ mockup مرجع نهایی می‌شه** — seed جدید همه ۱۱ ماژول رو upsert می‌کنه
- Endpointهای فاز ۱ (`GET /users/pending`, `POST /users/:id/approve`) از سه کلید موقت به `users.manage` مهاجرت می‌کنن
- سه کلید موقت از seed حذف می‌شن (چون هنوز دیتابیسی وجود نداره، داده‌ای هم از دست نمی‌ره)
- گروه‌های پیش‌فرض دقیقاً مطابق `DEFAULT_GROUPS` mockup دسترسی می‌گیرن: فروش (۱۴ کلید)، بازرگانی (۱۵ کلید)، مالی (۴ کلید)، مدیریت (همه)

## بک‌اند (apps/api)

### مدل‌های Prisma جدید (بدون migration جدید — جداول در baseline موجودن)

`BusinessPartner`, `PartnerContact`, `ItemCatalog` به `schema.prisma` اضافه می‌شن، دقیقاً منطبق بر ساختار `0001_baseline.sql`.

### BusinessPartnersModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /business-partners` | `partners.view` | لیست + جستجو (`q`) + فیلتر `partner_type` + صفحه‌بندی |
| `GET /business-partners/similar?name=` | `partners.create` | هشدار شباهت — `similarity()` از pg_trgm با `$queryRaw`، آستانه 0.3 |
| `POST /business-partners` | `partners.create` | |
| `GET /business-partners/:id` | `partners.view` | شامل رابطین |
| `PATCH /business-partners/:id` | `partners.edit` | |
| `DELETE /business-partners/:id` | `partners.delete` | حذف واقعی؛ رابطین CASCADE |
| `POST /business-partners/:id/contacts` | `partners.create` | |
| `PATCH /partner-contacts/:id` | `partners.edit` | |
| `DELETE /partner-contacts/:id` | `partners.delete` | |

- فیلدهای مخصوص ایران (استان/شهر/کدپستی/شناسه ملی/شماره ثبت) طبق design doc در دیتابیس همیشه nullable — نمایش شرطی (`country === 'ایران'`) فقط منطق UI
- فیلتر دید بر اساس `partner_type` (فروش فقط customer و…) طبق design doc منطق سطح اپلیکیشنه ولی **کلید مجزایی در کاتالوگ دسترسی mockup نداره** — فعلاً `partners.view` همه انواع رو می‌بینه؛ تفکیک به فاز بعدی موکول و در «خارج از اسکوپ» ثبت می‌شه

### ItemCatalogModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /item-catalog` | `catalog.view` | لیست + جستجو + فیلتر builder (چندتایی) |
| `GET /item-catalog/similar?code=&description=` | `catalog.create` | هشدار شباهت روی کد و شرح |
| `POST /item-catalog` | `catalog.create` | PK = خود `item_code` |
| `GET /item-catalog/:code` | `catalog.view` | |
| `PATCH /item-catalog/:code` | `catalog.create` | mockup کلید edit جدا نداره؛ همون create ملاک ویرایشه |
| `DELETE /item-catalog/:code` | `catalog.create` | فقط وقتی در استعلامی استفاده نشده (الان همیشه برقراره) |

- «سابقه استفاده» (usageHistory در mockup: کدوم استعلام/مشتری/نتیجه) به جدول `inquiry_items` وابسته‌ست که فاز ۳ است — در UI فاز ۲ این بخش با Empty State «هنوز در استعلامی استفاده نشده» می‌آد، بدون endpoint

### UsersModule (گسترش فاز ۱) + PermissionGroupsModule

| Endpoint | دسترسی | توضیح |
|---|---|---|
| `GET /users` | `users.manage` | همه کاربران + گروه |
| `GET /users/pending` | `users.manage` | (از فاز ۱ — کلید عوض می‌شه) |
| `POST /users/:id/approve` | `users.manage` | (از فاز ۱ — کلید عوض می‌شه) |
| `POST /users` | `users.manage` | ساخت سریع کاربر توسط مدیر (NewUserQuick در mockup) با رمز اولیه |
| `PATCH /users/:id` | `users.manage` | تغییر گروه / فعال‌وغیرفعال‌سازی |
| `GET /permissions` | `users.manage` | کاتالوگ کامل گروه‌بندی‌شده بر اساس module (برای رندر چک‌باکس‌ها) |
| `GET /permission-groups` | `users.manage` | گروه‌ها + تعداد اعضا + کلیدهای فعال |
| `POST /permission-groups` | `users.manage` | گروه سفارشی جدید |
| `PATCH /permission-groups/:id` | `users.manage` | تغییر نام/چک‌باکس‌ها؛ گروه‌های `is_default` فقط چک‌باکس‌هاشون قابل تغییره، نه نام‌شون |
| `DELETE /permission-groups/:id` | `users.manage` | فقط گروه غیرپیش‌فرضِ بدون عضو |

- **قانون ایمنی**: کاربر نمی‌تونه گروه خودش رو تغییر بده یا حذف کنه (جلوگیری از قفل‌کردن خود مدیر) — چک در سطح Service

## فرانت‌اند (apps/web)

### App Shell (`layouts/AppShell.tsx`)

- سایدبار با `NAV_GROUPS` از mockup: داشبورد / کار روزمره (استعلام‌ها، پیام‌ها) / ماژول‌های سراسری (مدیریت بارها، شرکت‌ها، کاتالوگ، مکاتبات) / گزارش‌ها / تنظیمات (کاربران)
- **فیلتر منو بر اساس دسترسی**: آیتم‌هایی که کاربر کلید `*.view` (یا `users.manage`) شون رو نداره از سایدبار حذف می‌شن — از `permissions` برگشتی `GET /auth/me`
- آیتم‌های ماژول‌های آینده (استعلام‌ها، پیام‌ها، بارها، مکاتبات، گزارش‌ها، داشبورد) به `PlaceholderPage` همون mockup می‌رن
- تاپ‌بار: عنوان صفحه + آواتار کاربر (منوی خروج) — جستجوی سراسری و زنگ اعلان فعلاً غیرفعال (دامنه ۹)
- موبایل: سایدبار کشویی با overlay (الگوی mockup)

### صفحات

| Route | مرجع بصری | نکات |
|---|---|---|
| `/partners` | business-partner-management-mockup | دو تب «شرکت‌ها/رابطین»، لیست + فیلتر نوع + جستجو، جزئیات شرکت با view/edit/delete-with-confirm، مدیریت رابطین داخل صفحه شرکت، فرم شرکت جدید با هشدار زنده شباهت (debounce روی `GET /similar`) |
| `/catalog` | item-catalog-mockup | لیست تخت + فیلتر برند (multi-select) + جستجو، جزئیات کالا view/edit/delete-with-confirm، فرم کالای جدید با هشدار شباهت، بخش سابقه استفاده = Empty State |
| `/users` | user-role-management-mockup | دو تب «کاربران/گروه‌های دسترسی»؛ بخش «در انتظار تأیید» بالای لیست کاربران (از `GET /users/pending`) با دکمه تأیید + انتخاب گروه؛ جزئیات گروه = چک‌باکس‌های دسترسی گروه‌بندی‌شده بر اساس ماژول |
| `/` | app-shell-mockup (HomeDashboard) | فعلاً Placeholder — ویجت‌های KPI دامنه ۹ است |

- همه صفحات داخل `ProtectedRoute` + AppShell
- الگوی داده: TanStack Query (`useQuery`/`useMutation` + invalidation)، بدون state manager اضافه
- کامپوننت‌های مشترک تکرارشونده در mockupها (`ConfirmModal`, `ViewField`, `TypeBadge`, ...) یک‌بار در `components/ui/` ساخته می‌شن

## Seed (به‌روزرسانی `prisma/seed.ts`)

1. کاتالوگ کامل ۱۱ ماژول از `PERMISSION_MODULES` (upsert بر اساس `permission_key`)
2. حذف سه کلید موقت فاز ۱ در صورت وجود
3. گروه‌های پیش‌فرض مطابق `DEFAULT_GROUPS` mockup (فروش/بازرگانی/مالی/مدیریت + کلیدهاشون)
4. ادمین seed مثل قبل (گروه مدیریت)

## تست‌ها

- **Jest (api)**: BusinessPartnersService (فیلتر/جستجو، منطق similar با mock)، PermissionGroupsService (قوانین: عدم حذف گروه دارای عضو، عدم تغییر گروه خود، محدودیت گروه پیش‌فرض)، UsersService (approve/create)
- **build web** + lint هر دو

## خارج از اسکوپ فاز ۲ (به‌صراحت)

- دامنه ۲ به بعد (استعلام، RFQ، ...) — «سابقه استفاده» کالا هم به تبعش
- فیلتر دید شرکت‌ها بر اساس نوع کاربر (فروش→مشتری، بازرگانی→تأمین‌کننده) — نیازمند تصمیم درباره کلید دسترسی جدید
- آپلود عکس پروفایل/مدارک هویتی کاربر، جستجوی سراسری تاپ‌بار، زنگ اعلان، `limit_value` در UI گروه‌ها (ساختارش در دیتابیس هست؛ فرم ورودش با اولین دسترسی supports_limit دار در فاز مربوطه می‌آد)
- `our_entities` (پنل مدیریتی‌ش طبق design doc فاز بعدیه)

## Definition of Done فاز ۲

- [ ] `0000_extensions` اضافه شده و `prisma migrate deploy` روی دیتابیس خالی بدون خطا کامل می‌شه
- [ ] Seed کاتالوگ کامل دسترسی‌ها + گروه‌های پیش‌فرض mockup
- [ ] CRUD کامل شرکت‌ها/رابطین با هشدار شباهت کارکردی (pg_trgm)
- [ ] CRUD کامل کاتالوگ کالا با هشدار شباهت
- [ ] UI کاربران: تأیید کاربر در انتظار، ساخت کاربر، تغییر گروه/وضعیت
- [ ] UI گروه‌ها: ساخت گروه سفارشی با چک‌باکس، ویرایش، حذف ایمن
- [ ] سایدبار بر اساس دسترسی کاربر فیلتر می‌شه
- [ ] قوانین ایمنی (خود-قفل‌نکردن مدیر) تست‌شده با Jest
- [ ] build + lint + test هر دو اپ سبز
- [ ] تست بصری صفحات با Preview (بدون دیتابیس فقط رندر و حالت‌های خطا؛ با دیتابیس روی سیستم شما: E2E کامل)
