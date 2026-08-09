// فاز ۵۸ (دنبالهٔ حادثهٔ production 2026-08-09) — نسخهٔ دائمیِ همون بخش امن seed.ts که
// فقط کاتالوگ دسترسی‌ها + گرنت پیش‌فرض گروه‌ها رو upsert می‌کنه، بدون upsertPayroll1405/
// upsertSeedAdmin/... که می‌تونن پیکربندی واقعی (حقوق و دستمزد، رمز ادمین) رو بازنویسی کنن.
//
// چرا این فایل جداست، نه صرفاً «همیشه seed.ts کامل رو اجرا کن»: چون deploy-production.yml
// (و به همین ترتیب هر فرآیند دیپلوی خودکار آینده) باید بتونه بعد از هر migration، کاتالوگ
// دسترسی‌های تازه‌اضافه‌شده رو خودکار به دیتابیس واقعی برسونه — دقیقاً همون باگی که باعث شد
// یک کاربر مدیریت فقط پروندهٔ خودش رو ببینه (inquiry.view_all هیچ‌وقت seed نشده بود) — بدون
// اینکه هر بار ریسک بازنویسی پیکربندی حقوق/دستمزد واقعی رو هم قبول کنیم.
//
// این اسکریپت idempotent و کاملاً افزودنیه به جز یک استثنای عمدی (revokeStalePartnersView،
// یک‌بارمصرف طبق طراحی فاز ۵۱) — امن برای اجرا در هر deploy، حتی وقتی چیزی عوض نشده.
import { PrismaClient } from "../generated/prisma";
import { DEFAULT_GROUP_GRANTS, PERMISSION_MODULES, RETIRED_PERMISSION_KEYS } from "./permission-catalog";

const prisma = new PrismaClient();

async function upsertPermissionCatalog(): Promise<Map<string, string>> {
  const keyToId = new Map<string, string>();
  for (const moduleDef of PERMISSION_MODULES) {
    for (const item of moduleDef.items) {
      const row = await prisma.permission.upsert({
        where: { permissionKey: item.key },
        update: { module: moduleDef.module, permissionLabel: item.label, supportsLimit: item.supportsLimit ?? false },
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
  const removed = await prisma.permission.deleteMany({ where: { permissionKey: { in: RETIRED_PERMISSION_KEYS } } });
  if (removed.count > 0) console.log(`🧹 ${removed.count} کلید موقت حذف شد`);
}

async function upsertDefaultGroups(keyToId: Map<string, string>) {
  const groups: Record<string, string> = {};
  for (const [groupName, grantedKeys] of Object.entries(DEFAULT_GROUP_GRANTS)) {
    const existing = await prisma.permissionGroup.findFirst({ where: { groupName } });
    const group = existing ?? (await prisma.permissionGroup.create({ data: { groupName, isDefault: true } }));
    groups[groupName] = group.id;
    for (const key of grantedKeys) {
      const permissionId = keyToId.get(key);
      if (!permissionId) throw new Error(`کلید ${key} در کاتالوگ نیست — permission-catalog.ts رو چک کن`);
      await prisma.permissionGroupItem.upsert({
        where: { permissionGroupId_permissionId: { permissionGroupId: group.id, permissionId } },
        update: {},
        create: { permissionGroupId: group.id, permissionId },
      });
    }
  }
  return groups;
}

/** فاز ۵۱ — یک‌بارمصرف، عمداً نگه‌داشته شده (نگاه کنید به seed.ts، همین تابع دقیقاً) */
async function revokeStalePartnersView(keyToId: Map<string, string>, groups: Record<string, string>) {
  const permissionId = keyToId.get("partners.view");
  const groupIds = [groups["فروش"], groups["بازرگانی"]].filter(Boolean);
  if (!permissionId || groupIds.length === 0) return;
  const removed = await prisma.permissionGroupItem.deleteMany({
    where: { permissionId, permissionGroupId: { in: groupIds } },
  });
  if (removed.count > 0) console.log(`🧹 دسترسی قدیمی «مشاهده همه شرکت‌ها» از ${removed.count} گروه (فروش/بازرگانی) حذف شد`);
}

async function main() {
  const keyToId = await upsertPermissionCatalog();
  await removeRetiredKeys();
  const groups = await upsertDefaultGroups(keyToId);
  await revokeStalePartnersView(keyToId, groups);
  console.log("✅ کاتالوگ دسترسی‌ها + گرنت‌های پیش‌فرض گروه‌ها همگام شد");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
