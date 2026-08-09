import * as argon2 from "argon2";
import { PrismaClient } from "../generated/prisma";
import {
  DEFAULT_GROUP_GRANTS,
  PERMISSION_MODULES,
  RETIRED_PERMISSION_KEYS,
} from "../src/permissions/permission-catalog";

const prisma = new PrismaClient();

async function upsertPermissionCatalog(): Promise<Map<string, string>> {
  const keyToId = new Map<string, string>();

  for (const moduleDef of PERMISSION_MODULES) {
    for (const item of moduleDef.items) {
      const row = await prisma.permission.upsert({
        where: { permissionKey: item.key },
        update: {
          module: moduleDef.module,
          permissionLabel: item.label,
          supportsLimit: item.supportsLimit ?? false,
        },
        create: {
          module: moduleDef.module,
          permissionKey: item.key,
          permissionLabel: item.label,
          supportsLimit: item.supportsLimit ?? false,
        },
      });
      keyToId.set(item.key, row.id);
    }
  }

  return keyToId;
}

async function removeRetiredKeys() {
  const removed = await prisma.permission.deleteMany({
    where: { permissionKey: { in: RETIRED_PERMISSION_KEYS } },
  });
  if (removed.count > 0) {
    console.log(`🧹 ${removed.count} کلید موقت فاز ۱ حذف شد`);
  }
}

async function upsertDefaultGroups(keyToId: Map<string, string>) {
  const groups: Record<string, string> = {};

  for (const [groupName, grantedKeys] of Object.entries(DEFAULT_GROUP_GRANTS)) {
    const existing = await prisma.permissionGroup.findFirst({ where: { groupName } });
    const group =
      existing ?? (await prisma.permissionGroup.create({ data: { groupName, isDefault: true } }));
    groups[groupName] = group.id;

    for (const key of grantedKeys) {
      const permissionId = keyToId.get(key);
      if (!permissionId) {
        throw new Error(`کلید ${key} در کاتالوگ نیست — permission-catalog.ts رو چک کن`);
      }
      await prisma.permissionGroupItem.upsert({
        where: {
          permissionGroupId_permissionId: { permissionGroupId: group.id, permissionId },
        },
        update: {},
        create: { permissionGroupId: group.id, permissionId },
      });
    }
  }

  return groups;
}

/**
 * فاز ۵۱ — بازخورد کاربر: فروش فقط مشتریان رو ببینه، بازرگانی فقط تأمین‌کنندگان رو.
 * چون upsertDefaultGroups فقط دسترسی اضافه می‌کنه (نه حذف)، partners.view قدیمی که این
 * دو گروه از قبل داشتن (قبل از این فاز) باید صریحاً حذف بشه — یک‌بار مصرف، هم‌الگوی removeRetiredKeys.
 */
async function revokeStalePartnersView(keyToId: Map<string, string>, groups: Record<string, string>) {
  const permissionId = keyToId.get("partners.view");
  const groupIds = [groups["فروش"], groups["بازرگانی"]].filter(Boolean);
  if (!permissionId || groupIds.length === 0) return;

  const removed = await prisma.permissionGroupItem.deleteMany({
    where: { permissionId, permissionGroupId: { in: groupIds } },
  });
  if (removed.count > 0) {
    console.log(`🧹 دسترسی قدیمی «مشاهده همه شرکت‌ها» از ${removed.count} گروه (فروش/بازرگانی) حذف شد`);
  }
}

async function upsertSeedAdmin(managementGroupId: string) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "⚠️  SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD در env تنظیم نشده — کاربر ادمین seed نشد.",
    );
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: { permissionGroupId: managementGroupId, status: "active" },
    create: {
      fullName: "مدیر سیستم",
      email,
      passwordHash,
      permissionGroupId: managementGroupId,
      status: "active",
    },
  });

  console.log(`✅ کاربر ادمین seed شد: ${email} (این credential فقط برای dev/local است)`);
}

// شرکت‌های واقعی گروه (design doc، دامنه ۱ و ۸) — پایه شماره‌گذاری نامه و طرف RFQ/PO
const OUR_ENTITIES = [
  { entityName: "پولاد تجهیز آپادانا", shortCode: "پ ت", calendarType: "jalali", country: "ایران" },
  { entityName: "General Trading srl", shortCode: "GT", calendarType: "gregorian", country: "Italy" },
  { entityName: "Landa Controls", shortCode: "LC", calendarType: "gregorian", country: "Italy" },
  { entityName: "Pasifik Global Makina", shortCode: "PGM", calendarType: "gregorian", country: "Turkey" },
] as const;

async function upsertOurEntities() {
  // فاز ۳۶: این شرکت‌ها از این پس از طریق پنل مدیریتی «شرکت‌های ما» قابل ویرایشن —
  // update خالیه تا اجرای مجدد seed ویرایش‌های ادمین رو پاک نکنه؛ فقط برای رکورد جدید create پر می‌شه
  for (const entity of OUR_ENTITIES) {
    await prisma.ourEntity.upsert({
      where: { shortCode: entity.shortCode },
      update: {},
      create: entity,
    });
  }
  console.log(`✅ ${OUR_ENTITIES.length} شرکت گروه seed شد`);
}

// قالب‌های پیش‌فرض نتیجهٔ فعالیت (فاز ۱۷، SPEC-PHASE-17) — به‌ازای هر نوع فعالیت
// ⚠️ effect جایگزین منطقی requiresFollowUp شد (توسعهٔ Work Management): close=بستن،
// create_follow_up=پیگیری (پیش‌فرض همون Task با سررسید جدید، نه لزوماً Task مستقل)،
// keep_waiting=انتقال به وضعیت انتظار بدون سررسید مشخص (منتظر شخص دیگر)
const ACTIVITY_OUTCOME_TEMPLATES = [
  { activityType: "call", label: "بی‌پاسخ", effect: "create_follow_up", followUpOffsetMinutes: 4 * 60 },
  { activityType: "call", label: "مشغول", effect: "create_follow_up", followUpOffsetMinutes: 2 * 60 },
  { activityType: "call", label: "تماس بعداً", effect: "create_follow_up", followUpOffsetMinutes: 24 * 60 },
  { activityType: "call", label: "با موفقیت انجام شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "email", label: "بدون پاسخ", effect: "create_follow_up", followUpOffsetMinutes: 2 * 24 * 60 },
  { activityType: "email", label: "پاسخ دریافت شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "meeting", label: "برگزار شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "meeting", label: "لغو/تعویق شد", effect: "create_follow_up", followUpOffsetMinutes: 24 * 60 },
  { activityType: "follow_up", label: "منتظر تأمین‌کننده", effect: "keep_waiting", followUpOffsetMinutes: null },
  { activityType: "follow_up", label: "منتظر مشتری", effect: "keep_waiting", followUpOffsetMinutes: null },
  { activityType: "follow_up", label: "نتیجه گرفته شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "approval", label: "تأیید شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "approval", label: "رد شد", effect: "close", followUpOffsetMinutes: null },
  { activityType: "approval", label: "نیاز به بررسی بیشتر", effect: "create_follow_up", followUpOffsetMinutes: 24 * 60 },
  { activityType: "internal_task", label: "انجام شد", effect: "close", followUpOffsetMinutes: null },
  // فاز ۵۱ — بازخورد کاربر: مرکز کار من فقط «انجام شد» داشت؛ چون internal_task رایج‌ترین
  // نوع کاره (ساخته‌شده از «مرکز کار من»)، گزینه‌های ارجاع-مانند/موکول هم لازم بود
  { activityType: "internal_task", label: "موکول به زمان دیگر", effect: "create_follow_up", followUpOffsetMinutes: 24 * 60 },
  { activityType: "internal_task", label: "منتظر شخص/چیز دیگری", effect: "keep_waiting", followUpOffsetMinutes: null },
  { activityType: "reminder", label: "انجام شد", effect: "close", followUpOffsetMinutes: null },
] as const;

async function upsertActivityOutcomeTemplates() {
  for (const template of ACTIVITY_OUTCOME_TEMPLATES) {
    const requiresFollowUp = template.effect === "create_follow_up";
    await prisma.activityOutcomeTemplate.upsert({
      where: { activityType_label: { activityType: template.activityType, label: template.label } },
      update: {
        isDefault: true,
        effect: template.effect,
        requiresFollowUp,
        followUpOffsetMinutes: template.followUpOffsetMinutes,
      },
      create: {
        activityType: template.activityType,
        label: template.label,
        isDefault: true,
        effect: template.effect,
        requiresFollowUp,
        followUpOffsetMinutes: template.followUpOffsetMinutes,
      },
    });
  }
  console.log(`✅ ${ACTIVITY_OUTCOME_TEMPLATES.length} قالب پیش‌فرض نتیجهٔ فعالیت seed شد`);
}

// ------------------------------------------------------------
// سال حقوقی ۱۴۰۵ — طبق قوانین کار/تأمین اجتماعی/مالیات اعلام‌شده توسط کاربر (کارشناس
// منابع انسانی)؛ هیچ عددی هاردکد نمی‌شه، همه در payroll_rules/payroll_tax_brackets
// نسخه‌بندی‌شده ذخیره می‌شه — نگاه کنید به دامنه ۱۲ در erp-database-design.md
// ------------------------------------------------------------

const MIN_DAILY_WAGE_1405 = 5_541_850; // حداقل دستمزد روزانه ۱۴۰۵ (ریال)

const PAYROLL_RULES_1405 = [
  {
    code: "MIN_DAILY_WAGE",
    title: "حداقل دستمزد روزانه",
    valueType: "number",
    value: MIN_DAILY_WAGE_1405,
  },
  {
    // ⚠️ از ۳۰٪ کل حق بیمه (۲۳٪ کارفرما + ۷٪ کارگر)، ۳٪ مربوط به بیمه بیکاریه که جدا
    // محاسبه و در ستون مستقل unemployment_insurance ذخیره می‌شه (نه داخل همین نرخ)
    code: "INSURANCE_RATE_EMPLOYEE",
    title: "نرخ بیمه سهم کارمند",
    valueType: "percent",
    value: 7,
  },
  {
    code: "INSURANCE_RATE_EMPLOYER",
    title: "نرخ بیمه سهم کارفرما (بدون احتساب بیمه بیکاری)",
    valueType: "percent",
    value: 20,
  },
  {
    code: "UNEMPLOYMENT_RATE",
    title: "نرخ بیمه بیکاری (سهم کارفرما)",
    valueType: "percent",
    value: 3,
  },
  {
    // سقف بیمه = ۷ برابر حداقل دستمزد روزانه × ۳۰ روز (چون مبنای بیمه در Engine ماهانه‌ست)
    code: "INSURANCE_CEILING",
    title: "سقف مزدی بیمه (ماهانه)",
    valueType: "number",
    value: MIN_DAILY_WAGE_1405 * 7 * 30,
  },
  {
    code: "TAX_EXEMPTION",
    title: "سقف معافیت مالیاتی حقوق ماهانه",
    valueType: "number",
    value: 400_000_000, // ۴۰,۰۰۰,۰۰۰ تومان
  },
  {
    code: "HOUSE_ALLOWANCE",
    title: "حق مسکن ماهانه",
    valueType: "number",
    value: 30_000_000,
  },
  {
    code: "FOOD_ALLOWANCE",
    title: "بن کارگری (کمک‌هزینه اقلام مصرفی خانوار) ماهانه",
    valueType: "number",
    value: 22_000_000,
  },
  {
    code: "CHILD_ALLOWANCE_DAYS",
    title: "ضریب حق اولاد (روز حداقل دستمزد به ازای هر فرزند)",
    valueType: "number",
    value: 3,
  },
  {
    code: "CHILD_ALLOWANCE_MAX_AGE",
    title: "سقف سنی حق اولاد",
    valueType: "number",
    value: 18,
  },
] as const;

// ⚠️ fromAmount/toAmount در مقیاس «درآمد پس از کسر معافیت» هستن (نگاه کنید به
// TaxEngineService.calculate — bandSize = toAmount-fromAmount، نه سطح مطلق درآمد)
const TAX_BRACKETS_1405 = [
  { bracketOrder: 1, fromAmount: 0, toAmount: 400_000_000, ratePercent: 10 }, // مازاد ۴۰ تا ۸۰M تومان
  { bracketOrder: 2, fromAmount: 400_000_000, toAmount: 600_000_000, ratePercent: 15 }, // ۸۰ تا ۱۰۰M
  { bracketOrder: 3, fromAmount: 600_000_000, toAmount: 800_000_000, ratePercent: 20 }, // ۱۰۰ تا ۱۲۰M
  { bracketOrder: 4, fromAmount: 800_000_000, toAmount: 1_000_000_000, ratePercent: 25 }, // ۱۲۰ تا ۱۴۰M
  { bracketOrder: 5, fromAmount: 1_000_000_000, toAmount: null, ratePercent: 30 }, // مازاد ۱۴۰M به بالا
] as const;

const PAYROLL_FORMULAS_1405 = [
  { code: "BASE", expression: "BASE_SALARY", description: "حقوق پایه — مستقیم از قرارداد فعال" },
  { code: "HOUSE", expression: "HOUSE_ALLOWANCE", description: "حق مسکن ثابت ماهانه" },
  { code: "FOOD", expression: "FOOD_ALLOWANCE", description: "بن کارگری ثابت ماهانه" },
  {
    code: "CHILD",
    expression: "CHILDREN_COUNT * CHILD_ALLOWANCE_DAYS * MIN_DAILY_WAGE",
    description: "حق اولاد = ۳ روز حداقل دستمزد روزانه × تعداد فرزندان واجد شرایط (زیر سقف سنی)",
  },
] as const;

// ⚠️ کاتالوگ اجزا سراسریه (کد یکتا در کل سیستم)، نه per-سال — formulaId به فرمول همین
// نسخه (۱۴۰۵) وصل می‌شه؛ سال بعد فقط بازپیوندش می‌کنیم، نه ساخت جزء جدید
const PAYROLL_COMPONENTS_1405 = [
  { code: "BASE", title: "حقوق پایه", componentType: "earning", isInsurable: true, isTaxable: true, calcOrder: 10 },
  { code: "HOUSE", title: "حق مسکن", componentType: "earning", isInsurable: true, isTaxable: true, calcOrder: 20 },
  { code: "FOOD", title: "بن کارگری", componentType: "earning", isInsurable: false, isTaxable: false, calcOrder: 30 },
  { code: "CHILD", title: "حق اولاد", componentType: "earning", isInsurable: false, isTaxable: false, calcOrder: 40 },
  // INSURANCE/TAX عمداً بدون فرمول — مقدارشون رو Insurance/Tax Engine مستقل تعیین می‌کنن
  { code: "INSURANCE", title: "بیمه سهم کارمند", componentType: "deduction", isInsurable: false, isTaxable: false, calcOrder: 90 },
  { code: "TAX", title: "مالیات حقوق", componentType: "deduction", isInsurable: false, isTaxable: false, calcOrder: 95 },
] as const;

async function upsertPayroll1405() {
  const year = await prisma.payrollYear.upsert({
    where: { yearNumber: 1405 },
    update: {},
    create: { yearNumber: 1405, calendarType: "jalali", status: "open" },
  });

  const ruleVersion = await prisma.payrollRuleVersion.upsert({
    where: { payrollYearId_versionNumber: { payrollYearId: year.id, versionNumber: 1 } },
    update: {},
    create: {
      payrollYearId: year.id,
      versionNumber: 1,
      title: "۱۴۰۵ — نسخه ۱",
      effectiveFrom: new Date("2026-03-21"),
      status: "active",
    },
  });

  const effectiveDate = new Date("2026-03-21");
  for (const rule of PAYROLL_RULES_1405) {
    await prisma.payrollRule.upsert({
      where: { ruleVersionId_code: { ruleVersionId: ruleVersion.id, code: rule.code } },
      update: { title: rule.title, valueType: rule.valueType, value: rule.value, effectiveDate },
      create: { ruleVersionId: ruleVersion.id, effectiveDate, ...rule },
    });
  }

  await prisma.payrollTaxBracket.deleteMany({ where: { ruleVersionId: ruleVersion.id } });
  await prisma.payrollTaxBracket.createMany({
    data: TAX_BRACKETS_1405.map((b) => ({ ruleVersionId: ruleVersion.id, ...b })),
  });

  const formulaIdByCode = new Map<string, string>();
  for (const formula of PAYROLL_FORMULAS_1405) {
    const row = await prisma.formula.upsert({
      where: { ruleVersionId_code: { ruleVersionId: ruleVersion.id, code: formula.code } },
      update: { expression: formula.expression, description: formula.description },
      create: { ruleVersionId: ruleVersion.id, ...formula },
    });
    formulaIdByCode.set(formula.code, row.id);
  }

  for (const component of PAYROLL_COMPONENTS_1405) {
    const formulaId = formulaIdByCode.get(component.code) ?? null;
    await prisma.payrollComponent.upsert({
      where: { code: component.code },
      update: { ...component, formulaId },
      create: { ...component, formulaId },
    });
  }

  console.log("✅ سال حقوقی ۱۴۰۵ (نسخه ۱) با قوانین/پله‌های مالیاتی/فرمول‌ها/اجزا seed شد");
}

async function main() {
  const keyToId = await upsertPermissionCatalog();
  await removeRetiredKeys();
  const groups = await upsertDefaultGroups(keyToId);
  await revokeStalePartnersView(keyToId, groups);
  await upsertSeedAdmin(groups["مدیریت"]);
  await upsertOurEntities();
  await upsertActivityOutcomeTemplates();
  await upsertPayroll1405();

  console.log(
    `✅ Seed کامل شد: ${keyToId.size} دسترسی در ${PERMISSION_MODULES.length} ماژول + ${Object.keys(groups).length} گروه پیش‌فرض`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
