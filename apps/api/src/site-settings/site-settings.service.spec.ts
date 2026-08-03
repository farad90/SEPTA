import { PrismaService } from "../prisma/prisma.service";
import { SiteSettingsService } from "./site-settings.service";

function buildPrisma() {
  return {
    siteSettings: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe("SiteSettingsService", () => {
  it("getSettings() ردیف تک‌شمارهٔ id=1 رو با upsert لِیزی برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.siteSettings.upsert.mockResolvedValue({ id: 1, loginBackgroundUrl: null });
    const service = new SiteSettingsService(prisma as unknown as PrismaService);

    await service.getSettings();

    expect(prisma.siteSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  });

  it("updateLoginBackground() آدرس فایل و کاربر ثبت‌کننده رو ذخیره می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.siteSettings.upsert.mockResolvedValue({ id: 1, loginBackgroundUrl: "uploads/x.png" });
    const service = new SiteSettingsService(prisma as unknown as PrismaService);

    await service.updateLoginBackground({ loginBackgroundUrl: "uploads/x.png" }, "user-1");

    expect(prisma.siteSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { loginBackgroundUrl: "uploads/x.png", updatedBy: "user-1" },
      create: { id: 1, loginBackgroundUrl: "uploads/x.png", updatedBy: "user-1" },
    });
  });

  it("updateLoginBackground() با مقدار null یعنی بازگردانی پیش‌فرض (حذف تصویر)", async () => {
    const prisma = buildPrisma();
    prisma.siteSettings.upsert.mockResolvedValue({ id: 1, loginBackgroundUrl: null });
    const service = new SiteSettingsService(prisma as unknown as PrismaService);

    await service.updateLoginBackground({ loginBackgroundUrl: null }, "user-1");

    expect(prisma.siteSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { loginBackgroundUrl: null, updatedBy: "user-1" },
      create: { id: 1, loginBackgroundUrl: null, updatedBy: "user-1" },
    });
  });

  it("getLoginBackgroundFileUrl() وقتی رکوردی نیست null برمی‌گردونه (نه خطا)", async () => {
    const prisma = buildPrisma();
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    const service = new SiteSettingsService(prisma as unknown as PrismaService);

    await expect(service.getLoginBackgroundFileUrl()).resolves.toBeNull();
  });

  it("getLoginBackgroundFileUrl() مسیر فایل ذخیره‌شده رو برمی‌گردونه", async () => {
    const prisma = buildPrisma();
    prisma.siteSettings.findUnique.mockResolvedValue({ id: 1, loginBackgroundUrl: "uploads/bg.jpg" });
    const service = new SiteSettingsService(prisma as unknown as PrismaService);

    await expect(service.getLoginBackgroundFileUrl()).resolves.toBe("uploads/bg.jpg");
  });
});
