import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";
import { ItemCatalogService } from "./item-catalog.service";

function buildPrisma() {
  return {
    itemCatalog: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    itemCatalogDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    measurementUnit: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
}

/** پرایسمای در-حافظه با یک Map پشتیبان — برای تست‌های Import که رفتار واقعی یکتایی/شمارنده لازم دارن */
function buildStatefulPrisma() {
  const table = new Map<string, { itemCode: string; status: string }>();
  let serial = 0;

  const itemCatalog = {
    findUnique: jest.fn(async ({ where }: { where: { itemCode: string } }) => {
      return table.get(where.itemCode) ?? null;
    }),
    create: jest.fn(async ({ data }: { data: { itemCode: string } }) => {
      const record = { ...data, status: "active" };
      table.set(data.itemCode, record as never);
      return record;
    }),
    update: jest.fn(async ({ where, data }: { where: { itemCode: string }; data: Record<string, unknown> }) => {
      const existing = table.get(where.itemCode)!;
      const updated = { ...existing, ...data };
      table.set(where.itemCode, updated as never);
      return updated;
    }),
  };

  const prisma = {
    itemCatalog,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ last_serial: serial }]),
        $executeRaw: jest.fn().mockImplementation(() => {
          serial += 1;
        }),
        itemCatalog,
      };
      return fn(tx);
    }),
  };
  return { prisma, table };
}

/** ساخت یک بافر اکسل واقعی با هدرهای فارسی مورد انتظار سرویس — برای تست Import */
async function buildXlsxBuffer(rows: Record<string, string>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("کالاها");
  sheet.columns = [
    { header: "کد کالا", key: "itemCode" },
    { header: "پارت نامبر", key: "partNumber" },
    { header: "شرح کالا", key: "itemDescription" },
    { header: "سازنده", key: "builder" },
    { header: "واحد اندازه‌گیری", key: "defaultMeasurementUnit" },
    { header: "وضعیت", key: "status" },
  ];
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("ItemCatalogService — کدینگ", () => {
  it("generates a sequential ITM-NNNNNN code when itemCode is omitted", async () => {
    const prisma = buildPrisma();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ last_serial: 41 }]),
        $executeRaw: jest.fn(),
        itemCatalog: { create: jest.fn((args) => args.data) },
      };
      return fn(tx);
    });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const result = await service.create(
      { partNumber: "BRG-6205", itemDescription: "بلبرینگ" } as never,
      "user-1",
    );

    expect(result.itemCode).toBe("ITM-000042");
  });

  it("accepts a manual itemCode when provided and unique", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalog.findUnique.mockResolvedValue(null);
    prisma.itemCatalog.create.mockResolvedValue({ itemCode: "CUSTOM-1" });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const result = await service.create(
      { itemCode: "CUSTOM-1", partNumber: "BRG-6205", itemDescription: "بلبرینگ" } as never,
      "user-1",
    );

    expect(result.itemCode).toBe("CUSTOM-1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a manual itemCode that already exists", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalog.findUnique.mockResolvedValue({ itemCode: "DUP-1" });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    await expect(
      service.create(
        { itemCode: "DUP-1", partNumber: "BRG-6205", itemDescription: "بلبرینگ" } as never,
        "user-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a duplicate measurement unit", async () => {
    const prisma = buildPrisma();
    prisma.measurementUnit.findUnique.mockResolvedValue({ id: "u1", unitName: "عدد" });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    await expect(service.addUnit("عدد")).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("ItemCatalogService — خروجی اکسل (فاز ۲۵)", () => {
  it("generates a workbook with Persian headers and one row per item, mapping status to Persian", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalog.findMany.mockResolvedValue([
      {
        itemCode: "ITM-000001",
        partNumber: "P-1",
        itemDescription: "شرح یک",
        builder: "SKF",
        defaultMeasurementUnit: "عدد",
        status: "active",
      },
      {
        itemCode: "ITM-000002",
        partNumber: "P-2",
        itemDescription: "شرح دو",
        builder: null,
        defaultMeasurementUnit: null,
        status: "inactive",
      },
    ] as never);
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const buffer = await service.export({});

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.worksheets[0];
    expect(sheet.getRow(1).getCell(1).text).toBe("کد کالا");
    expect(sheet.getRow(1).getCell(3).text).toBe("شرح کالا");
    expect(sheet.getRow(2).getCell(1).text).toBe("ITM-000001");
    expect(sheet.getRow(2).getCell(6).text).toBe("فعال");
    expect(sheet.getRow(3).getCell(4).text).toBe(""); // builder=null → خالی
    expect(sheet.getRow(3).getCell(6).text).toBe("غیرفعال");
  });
});

describe("ItemCatalogService — درون‌ریزی اکسل (فاز ۲۵)", () => {
  it("creates valid rows, rejects duplicate item codes and missing required fields, skips fully blank rows, and reports per-row results", async () => {
    const { prisma, table } = buildStatefulPrisma();
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const buffer = await buildXlsxBuffer([
      { itemCode: "", partNumber: "P-1", itemDescription: "شرح تستی یک", builder: "", defaultMeasurementUnit: "", status: "" },
      { itemCode: "MAN-1", partNumber: "P-2", itemDescription: "شرح تستی دو", builder: "ساخت", defaultMeasurementUnit: "عدد", status: "غیرفعال" },
      { itemCode: "MAN-1", partNumber: "P-3", itemDescription: "شرح تکراری", builder: "", defaultMeasurementUnit: "", status: "" },
      { itemCode: "", partNumber: "P-4", itemDescription: "", builder: "", defaultMeasurementUnit: "", status: "" },
      { itemCode: "", partNumber: "", itemDescription: "", builder: "", defaultMeasurementUnit: "", status: "" },
    ]);

    const report = await service.importFromExcel(buffer, "user-1");

    expect(report.totalRows).toBe(4); // ردیف کاملاً خالی (پنجم) شمرده نمی‌شه
    expect(report.createdCount).toBe(2);
    expect(report.failedCount).toBe(2);
    expect(report.errors).toEqual([
      expect.objectContaining({ row: 4, itemCode: "MAN-1", message: "این کد کالا قبلاً ثبت شده" }),
      expect.objectContaining({ row: 5, message: "شرح کالا الزامیه (حداقل ۲ کاراکتر)" }),
    ]);

    expect(table.get("MAN-1")?.status).toBe("inactive");
    expect(table.get("ITM-000001")).toBeTruthy(); // ردیف با کد خالی، کد خودکار گرفته
  });

  it("throws BadRequestException when the workbook has no worksheet", async () => {
    const { prisma } = buildStatefulPrisma();
    const service = new ItemCatalogService(prisma as unknown as PrismaService);
    const emptyWorkbookBuffer = Buffer.from(await new ExcelJS.Workbook().xlsx.writeBuffer());

    await expect(service.importFromExcel(emptyWorkbookBuffer, "user-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("ItemCatalogService — پیوست فایل در سطح کالا (فاز ۲۵)", () => {
  it("adds a document to an existing item", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalog.findUnique.mockResolvedValue({ itemCode: "ITM-1" });
    prisma.itemCatalogDocument.create.mockResolvedValue({ id: "doc-1", itemCode: "ITM-1" });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const result = await service.addDocument(
      "ITM-1",
      { fileUrl: "2026/07/x.pdf", fileName: "نقشه.pdf" },
      "user-1",
    );

    expect(result).toEqual({ id: "doc-1", itemCode: "ITM-1" });
    expect(prisma.itemCatalogDocument.create).toHaveBeenCalledWith({
      data: { itemCode: "ITM-1", fileUrl: "2026/07/x.pdf", fileName: "نقشه.pdf", uploadedBy: "user-1" },
    });
  });

  it("rejects adding a document to a non-existent item", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalog.findUnique.mockResolvedValue(null);
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    await expect(
      service.addDocument("MISSING", { fileUrl: "x" }, "user-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("removes an existing document", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalogDocument.findUnique.mockResolvedValue({ id: "doc-1" });
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    const result = await service.removeDocument("doc-1");

    expect(result).toEqual({ success: true });
    expect(prisma.itemCatalogDocument.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
  });

  it("rejects removing a non-existent document", async () => {
    const prisma = buildPrisma();
    prisma.itemCatalogDocument.findUnique.mockResolvedValue(null);
    const service = new ItemCatalogService(prisma as unknown as PrismaService);

    await expect(service.removeDocument("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});
