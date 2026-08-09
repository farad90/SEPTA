// ============================================================
// کاتالوگ مرجع دسترسی‌ها — منطبق بر mockups/user-role-management-mockup.jsx
// این فایل هم توسط seed استفاده می‌شه هم (در آینده) تست‌ها؛ mockup مرجع بصریه
// و این فایل مرجع کد. اگه چیزی اینجا عوض شد، چک‌باکس‌های UI هم باید هم‌خوان بمونن.
// ============================================================

export interface PermissionDef {
  key: string;
  label: string;
  supportsLimit?: boolean;
}

export interface PermissionModuleDef {
  module: string;
  label: string;
  items: PermissionDef[];
}

export const PERMISSION_MODULES: PermissionModuleDef[] = [
  {
    module: "inquiry",
    label: "ثبت استعلام",
    items: [
      { key: "inquiry.view", label: "مشاهده استعلام‌ها" },
      // P0-E3-F2-T3 — بدون این، هر دارنده‌ی inquiry.view همه‌ی پرونده‌ها رو می‌دید، نه فقط
      // پرونده‌های خودش؛ پیش‌فرض فقط گروه «مدیریت» (از طریق ALL_PERMISSION_KEYS پایین‌تر).
      { key: "inquiry.view_all", label: "مشاهده تمام پرونده‌های استعلام (نه فقط پرونده‌های خودم)" },
      { key: "inquiry.create", label: "ثبت استعلام جدید" },
      { key: "inquiry.edit", label: "ویرایش استعلام" },
      { key: "inquiry.delete", label: "حذف استعلام (انتقال به سطل حذف‌شده‌ها)" },
      { key: "inquiry.purge", label: "حذف قطعی و بازگردانی پرونده‌های حذف‌شده" },
      { key: "inquiry.assign", label: "واگذاری استعلام به همکار دیگر" },
      {
        key: "inquiry.view_commercial_details",
        label: "مشاهده جزئیات بازرگانی در گفتگو/لاگ فعالیت (نام تأمین‌کننده، مبالغ)",
      },
      { key: "inquiry.decline", label: "رد استعلام در مرحله اول (قبل از استعلام از تأمین‌کننده)" },
      // فاز ۵۸ — Case Owners: واگذاری دستی مالک تأمین/مالی پرونده (مکمل inquiry.assign
      // که فقط sales_expert_id رو تغییر می‌ده) — نگاه کنید به erp-database-design.md دامنه ۱۴
      { key: "inquiry.assign_procurement_owner", label: "واگذاری مالک تأمین پرونده" },
      { key: "inquiry.assign_finance_owner", label: "واگذاری مالک مالی پرونده" },
    ],
  },
  {
    module: "rfq",
    label: "استعلام از تأمین‌کنندگان",
    items: [
      { key: "rfq.view", label: "مشاهده استعلام‌های تأمین‌کننده" },
      { key: "rfq.send", label: "ارسال استعلام به تأمین‌کننده" },
      { key: "rfq.record_offer", label: "ثبت پیشنهاد قیمت دریافتی" },
      { key: "rfq.approve_delete", label: "تأیید/رد درخواست حذف RFQ" },
    ],
  },
  {
    module: "selection",
    label: "انتخاب نهایی و قیمت‌گذاری",
    items: [
      { key: "selection.view", label: "مشاهده مقایسه آفرها" },
      { key: "selection.select_offer", label: "انتخاب آفر نهایی هر قلم" },
      { key: "selection.set_markup", label: "تعیین حاشیه سود" },
      { key: "selection.lock", label: "قفل کردن انتخاب نهایی" },
    ],
  },
  {
    module: "proposal",
    label: "پیشنهاد به مشتری",
    items: [
      { key: "proposal.view", label: "مشاهده پیشنهادها" },
      { key: "proposal.generate", label: "تولید فایل پیشنهاد مالی/فنی" },
      { key: "proposal.edit_price", label: "ویرایش قیمت در نسخه جدید" },
      { key: "proposal.send_final", label: "ثبت نهایی و ارسال به مشتری" },
      {
        key: "proposal.approve_price_reduction",
        label: "تأیید کاهش قیمت پیشنهاد نسبت به قیمت پایه تعیین‌شده مدیریت",
      },
    ],
  },
  {
    module: "outcome",
    label: "نتیجه نهایی (برد/باخت)",
    items: [{ key: "outcome.record", label: "ثبت نتیجه برد/باخت" }],
  },
  {
    module: "order",
    label: "سفارش مشتری",
    items: [
      { key: "order.view", label: "مشاهده سفارش‌ها" },
      { key: "order.create", label: "ثبت سفارش مشتری" },
      { key: "order.manage_payments", label: "مدیریت پرداخت‌های مشتری" },
    ],
  },
  {
    module: "po",
    label: "سفارش خرید (PO)",
    items: [
      { key: "po.view", label: "مشاهده PO ها" },
      { key: "po.create", label: "صدور PO" },
      { key: "po.manage_payments", label: "مدیریت پرداخت به تأمین‌کننده" },
    ],
  },
  {
    module: "shipping",
    label: "حمل و گمرک / مدیریت بارها",
    items: [
      { key: "shipping.view", label: "مشاهده وضعیت بار" },
      { key: "shipping.record_packaging", label: "ثبت بسته‌بندی" },
      { key: "shipping.manage_freight_rfq", label: "مدیریت استعلام حمل (سراسری)" },
      { key: "shipping.manage_shipment", label: "مدیریت بار و اسناد گمرکی (سراسری)" },
      { key: "shipping.approve_edit", label: "تأیید درخواست اصلاح مراحل قفل‌شده محموله" },
      { key: "shipping.record_warehouse_receipt", label: "ثبت دریافت انبار و تصاویر" },
    ],
  },
  {
    module: "settlement",
    label: "تحویل و تسویه",
    items: [
      { key: "settlement.record_delivery", label: "ثبت تحویل به مشتری" },
      { key: "settlement.issue_invoice", label: "صدور فاکتور نهایی" },
      { key: "settlement.record_collection", label: "ثبت وصول مطالبات" },
    ],
  },
  {
    module: "partners",
    label: "شرکت‌ها و رابطین",
    items: [
      { key: "partners.view", label: "مشاهده همه شرکت‌ها (مشتری/تأمین‌کننده/...)" },
      { key: "partners.view_customers", label: "مشاهده فقط مشتریان" },
      { key: "partners.view_suppliers", label: "مشاهده فقط تأمین‌کنندگان (و شرکت‌های حمل)" },
      { key: "partners.create", label: "ثبت شرکت/رابط جدید" },
      { key: "partners.edit", label: "ویرایش شرکت/رابط" },
      { key: "partners.delete", label: "حذف شرکت/رابط" },
    ],
  },
  {
    module: "our_entities",
    label: "شرکت‌های ما",
    items: [
      { key: "our_entities.manage", label: "مدیریت شرکت‌های گروه (سربرگ، تماس، لوگو)" },
    ],
  },
  {
    module: "users",
    label: "کاربران و گروه‌های دسترسی",
    items: [{ key: "users.manage", label: "مدیریت کاربران و گروه‌های دسترسی" }],
  },
  {
    module: "site_settings",
    label: "تنظیمات سامانه",
    items: [
      { key: "site_settings.manage", label: "مدیریت تنظیمات ظاهری سامانه (پس‌زمینه ورود)" },
    ],
  },
  {
    module: "broadcast_messages",
    label: "پیام‌های اعلامی",
    items: [
      { key: "broadcast_messages.manage", label: "ایجاد و مدیریت پیام‌های اعلامی (Broadcast)" },
    ],
  },
  {
    module: "catalog",
    label: "کالاها",
    items: [
      { key: "catalog.view", label: "مشاهده کالاها" },
      { key: "catalog.create", label: "افزودن/ویرایش کالا" },
      { key: "catalog.manage_units", label: "مدیریت واحدهای اندازه‌گیری" },
      { key: "catalog.import", label: "درون‌ریزی اکسل کالاها" },
    ],
  },
  {
    module: "correspondence",
    label: "مکاتبات و بایگانی اسناد",
    items: [
      { key: "correspondence.view_own_department", label: "مشاهده نامه‌های واحد خودم" },
      { key: "correspondence.view_all", label: "مشاهده نامه‌های همه واحدها" },
      { key: "correspondence.create", label: "ثبت پیش‌نویس نامه و آپلود سند" },
      { key: "correspondence.register", label: "ثبت رسمی و صدور شماره نامه" },
      { key: "correspondence.refer", label: "ارجاع نامه به کارشناس" },
      { key: "correspondence.archive", label: "ثبت مراحل گردش کار و بایگانی" },
      { key: "correspondence.delete", label: "حذف نامه" },
    ],
  },
  {
    module: "hr",
    label: "منابع انسانی",
    items: [
      { key: "hr.view", label: "مشاهده ساختار سازمانی و پرونده پرسنل" },
      // P0-E3-F2-T4 — بدون این، هر دارنده‌ی hr.view (شامل گروه پیش‌فرض «منابع انسانی»)
      // پرونده‌ی هر پرسنلی رو می‌دید، نه فقط بخش خودش؛ پیش‌فرض فقط گروه «مدیریت»
      // (از طریق ALL_PERMISSION_KEYS) — گروه «منابع انسانی» هم صراحتاً پایین‌تر
      // بهش مجهز شده تا رفتار فعلیش (دید کامل) عوض نشه؛ محدودسازی به بخش خود فقط
      // برای گروه‌های سفارشی آینده‌ای معناداره که فقط hr.view دارن، نه این کلید رو هم.
      { key: "hr.view_all", label: "مشاهده پرونده تمام پرسنل (نه فقط بخش خودم)" },
      { key: "hr.manage", label: "ایجاد/ویرایش بخش‌ها، پرسنل و قراردادها" },
    ],
  },
  {
    module: "action_center",
    label: "مرکز اقدامات",
    items: [
      { key: "action_center.view_team", label: "مشاهده فعالیت‌های تیم (نه فقط فعالیت‌های خودم)" },
    ],
  },
  {
    module: "payroll_engine",
    label: "حقوق و دستمزد",
    items: [
      { key: "payroll_engine.view", label: "مشاهده دوره‌ها، فیش حقوقی و گزارش‌ها" },
      { key: "payroll_engine.manage_config", label: "مدیریت قوانین، فرمول‌ها و اجزای حقوق (Rule Engine)" },
      { key: "payroll_engine.manage_profile", label: "مدیریت پروفایل حقوقی پرسنل" },
      { key: "payroll_engine.manage_worklog", label: "اصلاح دستی کارکرد ماهانه (WorkLog)" },
      { key: "payroll_engine.run_calculation", label: "اجرای محاسبه‌ی حقوق یک دوره" },
      { key: "payroll_engine.review", label: "بازبینی نتیجه‌ی محاسبه‌شده" },
      { key: "payroll_engine.approve", label: "تأیید نهایی نتیجه‌ی حقوق" },
      { key: "payroll_engine.post", label: "ثبت حسابداری (ارسال به سیستم مالی)" },
      { key: "payroll_engine.lock", label: "قفل نهایی دوره (غیرقابل بازگشت)" },
    ],
  },
  {
    module: "reports",
    label: "گزارش‌ها و تحلیل‌ها",
    items: [
      { key: "reports.view_orders_pnl", label: "مشاهده گزارش سفارشات و سود و زیان" },
      { key: "reports.view_payments", label: "مشاهده گزارش پرداختی‌ها و دریافتی‌ها" },
      { key: "reports.view_conversion", label: "مشاهده گزارش تبدیل استعلام به سفارش" },
      { key: "reports.view_own_sales_summary", label: "مشاهده مبلغ سفارشات خودِ کاربر (بدون قیمت خرید/سود)" },
      { key: "reports.view_rfq_response_rate", label: "مشاهده نرخ پاسخ‌دهی تأمین‌کنندگان به استعلام قیمت" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => m.items.map((i) => i.key));

// گروه‌های پیش‌فرض و دسترسی‌هاشون — مطابق DEFAULT_GROUPS در mockup
export const DEFAULT_GROUP_GRANTS: Record<string, string[]> = {
  فروش: [
    "inquiry.view",
    "inquiry.create",
    "inquiry.edit",
    "inquiry.assign",
    "proposal.view",
    "proposal.generate",
    "proposal.edit_price",
    "proposal.send_final",
    "outcome.record",
    "order.view",
    "order.create",
    "shipping.view",
    "shipping.record_packaging",
    "shipping.record_warehouse_receipt",
    "settlement.record_delivery",
    "partners.view_customers",
    "partners.create",
    "correspondence.view_own_department",
    "correspondence.create",
    "correspondence.register",
    "correspondence.refer",
    "correspondence.archive",
    "reports.view_conversion",
    "reports.view_own_sales_summary",
  ],
  بازرگانی: [
    "inquiry.view_commercial_details",
    "inquiry.decline",
    "rfq.view",
    "rfq.send",
    "rfq.record_offer",
    "selection.view",
    "selection.select_offer",
    "po.view",
    "po.create",
    "shipping.view",
    "shipping.record_packaging",
    "shipping.manage_freight_rfq",
    "shipping.manage_shipment",
    "inquiry.assign_procurement_owner",
    "partners.view_suppliers",
    "partners.create",
    "catalog.view",
    "catalog.create",
    "catalog.manage_units",
    "catalog.import",
    "correspondence.view_own_department",
    "correspondence.create",
    "correspondence.register",
    "correspondence.refer",
    "correspondence.archive",
    "reports.view_rfq_response_rate",
  ],
  مالی: [
    "order.manage_payments",
    "po.manage_payments",
    "settlement.issue_invoice",
    "settlement.record_collection",
    "inquiry.assign_finance_owner",
    "correspondence.view_own_department",
    "correspondence.create",
    "correspondence.register",
    "correspondence.refer",
    "correspondence.archive",
    // مدیر مالی (Finance Manager) — سه گام پایانی گردش حقوق: تأیید، ثبت حسابداری، قفل نهایی
    "payroll_engine.view",
    "payroll_engine.approve",
    "payroll_engine.post",
    "payroll_engine.lock",
    "reports.view_orders_pnl",
    "reports.view_payments",
  ],
  "منابع انسانی": [
    "hr.view",
    // P0-E3-F2-T4 — این گروه پیش‌فرض عمداً محدود به بخش خودش نشد (بر خلاف
    // «فروش» در inquiry.view_all که آگاهانه محدود موند) — چون یک واحد منابع
    // انسانی متمرکز و سراسری، معمولاً باید همه‌ی پرسنل شرکت رو ببینه، نه فقط
    // هم‌بخشی‌های خودش. اگه کسب‌وکار در آینده یک نقش محدودتر (مثلاً «رابط
    // منابع انسانی» در سطح یک بخش) خواست، همین‌جا این خط رو برای گروه سفارشی
    // جدید حذف کنه — نیازی به تغییر کد نیست، فقط تنظیم گروه دسترسی.
    "hr.view_all",
    "hr.manage",
    "payroll_engine.view",
    "payroll_engine.manage_profile",
  ],
  "کارشناس حقوق و دستمزد": [
    "payroll_engine.view",
    "payroll_engine.manage_config",
    "payroll_engine.manage_worklog",
    "payroll_engine.run_calculation",
    "payroll_engine.review",
  ],
  بازدیدکننده: ["payroll_engine.view"],
  مدیریت: ALL_PERMISSION_KEYS,
};

/** کلیدهای موقت فاز ۱ که با کاتالوگ mockup جایگزین شدن */
export const RETIRED_PERMISSION_KEYS = [
  "users.view_pending",
  "users.approve",
  "users.assign_permission_group",
];

// فاز ۵۸ (ادامهٔ حادثهٔ production ۲۰۲۶-۰۸-۰۹) — بعد از بررسی کامل کاتالوگ + دیتای واقعی
// Production، سه نوع تداخل شناسایی شد. این سه ثابت فقط «قانون» رو تعریف می‌کنن؛ اعمال واقعی
// در PermissionGroupsService انجام می‌شه (نگاه کنید به normalizeAndValidateKeys آنجا).

/**
 * خانواده‌های «دسترسی گسترده جایگزین چند دسترسی محدود» — مثال کاربر: partners.view (همه
 * شرکت‌ها) در برابر partners.view_customers/partners.view_suppliers. کد مصرف‌کننده
 * (BusinessPartnersService) از قبل broad رو برنده می‌دونه؛ اینجا فقط جلوی ذخیره‌ی هم‌زمان یک
 * چک‌باکس گسترده و چک‌باکس‌های محدودِ همون خانواده گرفته می‌شه — broad ذخیره می‌شه، narrow های
 * زائد به‌صورت خودکار از ست ذخیره‌شده حذف می‌شن (بدون خطا؛ چون broad قبلاً همون قابلیت رو داره).
 */
export const BROAD_NARROW_FAMILIES: { broad: string; narrow: string[] }[] = [
  { broad: "partners.view", narrow: ["partners.view_customers", "partners.view_suppliers"] },
];

/**
 * دسترسی‌های «توسعه‌یافته» که بدون دسترسی پایه‌شون در Controller هیچ اثری ندارن (۴۰۳ می‌خورن)
 * — مثلاً inquiry.view_all بدون inquiry.view. اگه کلید توسعه‌یافته در ست ارسالی باشه ولی پایه‌ش
 * نباشه، ذخیره با خطا رد می‌شه (نه auto-imply، چون اضافه‌کردن خاموشِ یک دسترسی دیگه می‌تونه
 * غافلگیرکننده باشه — همون فلسفه‌ی خطای صریح resolveKeys برای کلید ناشناخته).
 */
export const DEPENDENT_PERMISSION_KEYS: { key: string; requires: string }[] = [
  { key: "inquiry.view_all", requires: "inquiry.view" },
  { key: "hr.view_all", requires: "hr.view" },
  { key: "hr.manage", requires: "hr.view" },
  { key: "correspondence.view_all", requires: "correspondence.view_own_department" },
];

/**
 * جفت‌های حساس از نظر تفکیک وظایف (Segregation of Duties) — وقتی هر دو کلید یک جفت هم‌زمان در
 * یک گروه باشن، همون فرد هم «درخواست‌دهنده» هم «تأییدکننده» می‌شه (مثلاً بازرگانی که هم
 * proposal.edit_price هم proposal.approve_price_reduction داره می‌تونه تخفیف خودش رو خودش تأیید
 * کنه). این‌ها Business Decision هستن، نه خطای فنی — پس فقط هشدار (warnings در پاسخ create/update)
 * برمی‌گردن، ذخیره مسدود نمی‌شه؛ چون گروه «بازرگانی» در Production عمداً همین ترکیب رو داره.
 */
export const SOD_SENSITIVE_PAIRS: { pair: [string, string]; message: string }[] = [
  {
    pair: ["proposal.edit_price", "proposal.approve_price_reduction"],
    message:
      "این گروه هم می‌تونه قیمت پیشنهاد رو کاهش بده هم همون کاهش رو تأیید کنه — تأیید مدیریتی فاز ۳۵-ج عملاً دور زده می‌شه.",
  },
  {
    pair: ["shipping.manage_shipment", "shipping.approve_edit"],
    message:
      "این گروه هم می‌تونه درخواست اصلاح مرحلهٔ قفل‌شدهٔ محموله بده هم همون درخواست رو تأیید کنه — گردش تأیید فاز ۲۷ عملاً دور زده می‌شه.",
  },
  {
    pair: ["payroll_engine.review", "payroll_engine.approve"],
    message:
      "این گروه هم می‌تونه نتیجهٔ محاسبهٔ حقوق رو بازبینی کنه هم همون نتیجه رو تأیید نهایی کنه — تفکیک بازبین/تأییدکننده در گردش حقوق عملاً دور زده می‌شه.",
  },
];
