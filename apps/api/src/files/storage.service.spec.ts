import { StorageService } from "./storage.service";

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

describe("StorageService.save — فاز ۴۹ (folderHint / preferredBaseName)", () => {
  it("بدون options: مسیر سال/ماه پیش‌فرض رو برمی‌گردونه (رفتار قدیمی دست‌نخورده)", async () => {
    const service = new StorageService();
    const stored = await service.save("report.pdf", Buffer.from("x"));
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    expect(stored.fileUrl).toMatch(new RegExp(`^${year}/${month}/[0-9a-f-]+\\.pdf$`));
    expect(stored.fileName).toBe("report.pdf");
  });

  it("با folderHint: فایل به‌جای سال/ماه، در یک پوشه‌ی مشترک ذخیره می‌شه", async () => {
    const service = new StorageService();
    const stored = await service.save("report.pdf", Buffer.from("x"), { folderHint: "INQ-2026-0028" });
    expect(stored.fileUrl).toMatch(/^INQ-2026-0028\/[0-9a-f-]+\.pdf$/);
  });

  it("folderHint با کاراکترهای غیرمجاز (فارسی/فاصله) پاکسازی می‌شه", async () => {
    const service = new StorageService();
    const stored = await service.save("report.pdf", Buffer.from("x"), { folderHint: "پ ت / ../../etc" });
    // هیچ بخشی از fileUrl نباید شامل .. یا کاراکتر غیرمجاز باشه (امنیت مسیر)
    expect(stored.fileUrl).not.toContain("..");
    expect(stored.fileUrl.split("/")).toHaveLength(2);
  });

  it("با preferredBaseName: نام فایل فیزیکی به‌جای uuid خام، از اون مشتق می‌شه", async () => {
    const service = new StorageService();
    const stored = await service.save("report.pdf", Buffer.from("x"), {
      preferredBaseName: "Commercial Offer-2026-0007-fa",
    });
    const storedName = stored.fileUrl.split("/").pop()!;
    expect(storedName).toMatch(/^Commercial-Offer-2026-0007-fa-[0-9a-f]{8}\.pdf$/);
  });

  it("fileName بازگشتی همیشه نام اصلی (originalName) می‌مونه، نه نام پاکسازی‌شده", async () => {
    const service = new StorageService();
    const stored = await service.save("پیشنهاد مالی.pdf", Buffer.from("x"), {
      folderHint: "INQ-2026-0028",
      preferredBaseName: "Commercial Offer",
    });
    expect(stored.fileName).toBe("پیشنهاد مالی.pdf");
  });

  it("پسوند غیرمجاز رد می‌شه (رفتار قدیمی validate دست‌نخورده)", async () => {
    const service = new StorageService();
    await expect(service.save("virus.exe", Buffer.from("x"))).rejects.toThrow();
  });

  it("فرمت TIF/TIFF و ZIP هم مجازن", async () => {
    const service = new StorageService();
    await expect(service.save("scan.tif", Buffer.from("x"))).resolves.toBeDefined();
    await expect(service.save("scan.tiff", Buffer.from("x"))).resolves.toBeDefined();
    await expect(service.save("archive.zip", Buffer.from("x"))).resolves.toBeDefined();
  });
});
