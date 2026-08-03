# SPEC — فاز ۱: Scaffold + Migration + Auth/RBAC

> این سند فقط فاز اول پروژه «سپتا» رو پوشش می‌ده. فازهای بعدی (استعلام، تأمین، سفارش، حمل/گمرک، تسویه، مکاتبات، چت) اسکوپ این سند نیستن.

## هدف فاز ۱

1. Scaffold مونوریپو (بک‌اند + فرانت‌اند)
2. اجرای کامل `erp-schema.sql` روی یک دیتابیس PostgreSQL تازه، بدون تغییر محتوا
3. سیستم احراز هویت (ثبت‌نام درخواستی → تأیید مدیر → ورود) و RBAC مبتنی بر `permission_groups`
4. صفحات `/login` و `/register` مطابق `mockups/auth-pages-mockup.jsx` با state واقعی (نه mock)

## Stack نهایی

| لایه | انتخاب |
|---|---|
| بک‌اند | NestJS + TypeScript |
| ORM | Prisma (schema از دیتابیس migrate‌شده با `prisma db pull` تولید می‌شه، نه برعکس) |
| دیتابیس | PostgreSQL (طبق `erp-schema.sql`) |
| احراز هویت | JWT access (کوتاه‌مدت) + refresh token در httpOnly cookie |
| هش رمز عبور | argon2 |
| فرانت‌اند | Vite + React + TypeScript + Tailwind CSS |
| مدیریت وضعیت فرانت | TanStack Query (API) + Context/Zustand (وضعیت احراز هویت) |
| مونوریپو | pnpm workspaces |
| کانتینر | Docker Compose (Postgres + API) |
| تست | Jest |

## ساختار پوشه‌بندی

```
/
├── apps/
│   ├── api/                  # NestJS
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   │   ├── 0001_baseline.sql        # عیناً erp-schema.sql
│   │   │   │   └── 0002_auth_fields.sql     # password_hash, refresh_tokens, ...
│   │   │   ├── seed.ts                      # permission_groups پیش‌فرض + کاربر ادمین seed
│   │   │   └── schema.prisma                # نتیجه db pull
│   │   └── src/
│   │       ├── auth/                        # AuthController, AuthService, Strategies, Guards
│   │       ├── users/                       # حداقلی: approve/assign-group
│   │       ├── permissions/                 # PermissionsGuard, RequirePermissions decorator
│   │       ├── prisma/                      # PrismaModule/PrismaService
│   │       └── common/                      # config, filters, pipes
│   └── web/                  # Vite + React
│       └── src/
│           ├── pages/auth/                  # از mockups/auth-pages-mockup.jsx
│           ├── lib/auth-context.tsx
│           └── lib/api-client.ts
├── packages/
│   └── shared/                # Enum/Typeهای مشترک بین api و web
├── mockups/                   # (بدون تغییر — مرجع بصری)
├── assets/                    # (بدون تغییر)
├── erp-schema.sql             # (بدون تغییر — منبع حقیقت)
├── erp-database-design.md
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## دیتابیس و Migration

- **`0001_baseline.sql`**: عیناً همون `erp-schema.sql` است — بدون تغییر، بدون تفکیک. اجرای این فایل روی یک دیتابیس خالی باید دقیقاً همون چیزی رو بسازه که در `erp-database-design.md` مستند شده.
- **`0002_auth_fields.sql`**: چون دیتابیس تازه‌ست (بدون رکورد موجود)، ستون‌های `NOT NULL` بدون نیاز به backfill/default قابل افزودنن:
  - `users.password_hash TEXT NOT NULL`
  - `users.password_reset_token TEXT`, `users.password_reset_token_expires_at TIMESTAMPTZ`
  - `users.requested_department VARCHAR(50)` — فیلد «واحد سازمانی» فرم ثبت‌نام؛ صرفاً راهنمای متنی برای مدیر تأییدکننده، هیچ اثر مستقیمی روی تعیین `permission_group_id` نداره
  - `CREATE TABLE refresh_tokens (id, user_id FK, token_hash, expires_at, revoked_at, created_at, user_agent, ip_address)`
- بعد از اجرای `0001` و `0002`، دستور `prisma db pull` روی دیتابیس اجرا می‌شه تا `schema.prisma` تولید بشه؛ Prisma هرگز مستقیماً schema تولید/تغییر نمی‌ده.
- Migrationهای بعدی (فازهای آینده) به همین ترتیب افزایشی اضافه می‌شن؛ `erp-schema.sql` دیگه هیچ‌وقت مستقیم دستکاری نمی‌شه — تغییرات ساختاری بعدی از طریق migration فایل‌های جدید.

## RBAC — نکته کلیدی معماری

هیچ claim مربوط به دسترسی داخل JWT قرار نمی‌گیره. Access token فقط `user_id` رو حمل می‌کنه. `PermissionsGuard` در هر Request، `permission_group_id` کاربر و ردیف‌های `permission_group_items` مرتبط رو مستقیم از دیتابیس می‌خونه. این یعنی وقتی مدیر گروه دسترسی کاربری رو عوض می‌کنه، همون درخواست بعدی کاربر بلافاصله اثر تغییر رو می‌بینه — نیازی به expire شدن توکن نیست.

- `@RequirePermissions('users.approve')` دکوریتور روی Controller method
- `PermissionsService.getEffectivePermissions(userId)` → لیست `permission_key` + `limit_value` (برای `supports_limit=true`)
- کاربری که `permission_group_id IS NULL` داره (هنوز تأیید نشده) هیچ دسترسی‌ای نداره و اصلاً اجازه لاگین موفق نداره (پایین‌تر توضیح داده شده)

## جریان ثبت‌نام / تأیید / ورود

1. **ثبت‌نام** (`POST /auth/register`, صفحه `RegisterPage` از mockup): کاربر با `permission_group_id = NULL` ساخته می‌شه. پاسخ موفق = همون پیام mockup («درخواست شما ثبت شد ... بعد از تأیید و تعیین گروه دسترسی...»).
2. **تأیید مدیر** (خارج از UI در فاز ۱ — توضیح در بخش «خارج از اسکوپ»): از طریق دو Endpoint حداقلی:
   - `GET /users/pending` (نیازمند `users.view_pending`)
   - `POST /users/:id/approve { permission_group_id }` (نیازمند `users.assign_permission_group`)
3. **ورود** (`POST /auth/login`, صفحه `LoginPage`): با ایمیل یا موبایل + رمز عبور. اگر `permission_group_id IS NULL` → خطای مشخص «حساب شما هنوز تأیید نشده». در غیر این صورت access+refresh token صادر می‌شه.
4. **`GET /auth/me`**: کاربر جاری + لیست کامل `permission_key`های مؤثرش (برای فرانت جهت نمایش/مخفی‌کردن اجزای UI).
5. **`POST /auth/refresh`**: چرخش (rotate) refresh token از روی cookie.
6. **`POST /auth/logout`**: باطل کردن (`revoked_at`) refresh token جاری.

## فرانت‌اند (apps/web) — اسکوپ فاز ۱

- صفحات `/login` و `/register` عیناً بر پایه `mockups/auth-pages-mockup.jsx` (توکن‌های رنگ، فونت Vazirmatn، لوگوها از `assets/`)، فقط با جایگزینی state محلی mock با فراخوانی واقعی API.
- بعد از ورود موفق: ریدایرکت به یک صفحه Placeholder احرازشده ساده (نه dashboard-mockup کامل — آن فاز بعدیه) که فقط نام کاربر + دکمه خروج رو نشون می‌ده، صرفاً برای اثبات round-trip احراز هویت.
- Access token در حافظه (memory, نه localStorage) نگه داشته می‌شه؛ refresh token در httpOnly cookie. رفرش خودکار در لود اولیه صفحه.
- Route guard: بدون session معتبر → ریدایرکت به `/login`.

## خارج از اسکوپ فاز ۱ (به‌صراحت)

- رابط کاربری کامل «کاربران و گروه‌های دسترسی» (`user-role-management-mockup.jsx`) — فقط دو Endpoint حداقلی برای تأیید/تخصیص گروه پیاده می‌شه، بدون صفحه
- تمام دامنه‌های ۲ تا ۹ (استعلام، تأمین، سفارش/PO، تولید/حمل/گمرک، تحویل/تسویه، مکاتبات، اعلان/چت)
- آپلود مدارک هویتی (`user_identity_documents`) و تصویر پروفایل
- Seed کامل جدول `permissions` برای همه ماژول‌ها — فقط حداقل لازم برای جریان تأیید کاربر (`users.view_pending`, `users.approve`, `users.assign_permission_group`) seed می‌شه؛ بقیه permissionها همراه با هر ماژول در فاز مربوطه اضافه می‌شن
- نرخ ارز زنده / API خارجی

## فرضیات نیازمند تأیید صریح شما

1. **`requested_department`**: چون erp-schema.sql ستونی برای «واحد سازمانی» فرم ثبت‌نام نداره، این ستون در `0002_auth_fields.sql` اضافه می‌شه؛ صرفاً متنی/راهنما، بدون قانون کسب‌وکاری متصل به `permission_group_id`.
2. **معنای «در انتظار تأیید»**: چون `users.status` فقط `active`/`inactive` داره، به‌جای افزودن مقدار جدید به CHECK constraint، از `permission_group_id IS NULL` به‌عنوان معنای «در انتظار تأیید» استفاده می‌شه.
3. **کاربر Seed**: یک کاربر ادمین با گروه «مدیریت» در `seed.ts` ساخته می‌شه تا اولین ورود ممکن باشه؛ Credential آن در seed script مستند می‌شه (فقط برای محیط dev/local، نه secret واقعی production).
4. هش رمز عبور با `argon2` (نه bcrypt) — الگوریتم مدرن‌تر توصیه‌شده فعلی.

## Definition of Done فاز ۱

- [ ] مونوریپو pnpm scaffold شده (`apps/api`, `apps/web`, `packages/shared`)
- [ ] `docker compose up` یک Postgres سالم بالا می‌آره
- [ ] `0001_baseline.sql` + `0002_auth_fields.sql` + seed با یک دستور اجرا می‌شن
- [ ] `schema.prisma` از دیتابیس migrate‌شده تولید و `PrismaClient` generate می‌شه
- [ ] `POST /auth/register` کاربر با `permission_group_id = NULL` می‌سازه
- [ ] `POST /auth/login` برای کاربر تأییدنشده خطای مشخص برمی‌گردونه
- [ ] کاربر seed (ادمین) می‌تونه لاگین کنه و access+refresh token بگیره
- [ ] `GET /auth/me` لیست `permission_key`های کاربر رو برمی‌گردونه
- [ ] `POST /auth/refresh` توکن رو rotate می‌کنه؛ `POST /auth/logout` آن رو revoke می‌کنه
- [ ] صفحات `/login` و `/register` مطابق mockup با state واقعی کار می‌کنن
- [ ] بعد از لاگین موفق ریدایرکت به صفحه Placeholder احرازشده
- [ ] تست‌های Jest (AuthService، PermissionsGuard) سبزن
- [ ] README ریشه با دستورات راه‌اندازی (`docker up`, `migrate`, `seed`, `dev`)
