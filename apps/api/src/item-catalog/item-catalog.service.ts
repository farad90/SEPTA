import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddCatalogDocumentDto,
  CreateItemDto,
  ListItemsQueryDto,
  UpdateItemDto,
} from "./dto/item.dto";

const SIMILARITY_THRESHOLD = 0.3;
const DEFAULT_PAGE_SIZE = 20;

export interface SimilarItem {
  itemCode: string;
  partNumber: string;
  itemDescription: string;
  builder: string | null;
  similarity: number;
}

/** ستون‌های اکسل — هم برای Import هم Export، هدرها فارسی و بر اساس نام تطبیق می‌شن نه موقعیت */
const EXCEL_COLUMNS = [
  { header: "کد کالا", key: "itemCode" },
  { header: "پارت نامبر", key: "partNumber" },
  { header: "شرح کالا", key: "itemDescription" },
  { header: "سازنده", key: "builder" },
  { header: "واحد اندازه‌گیری", key: "defaultMeasurementUnit" },
  { header: "وضعیت", key: "status" },
] as const;

export interface ImportRowError {
  row: number;
  itemCode?: string;
  message: string;
}

export interface ImportReport {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: ImportRowError[];
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as { text: string }[]).map((t) => t.text).join("");
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text);
  }
  return String(value).trim();
}

@Injectable()
export class ItemCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: Pick<ListItemsQueryDto, "q" | "builders">): Prisma.ItemCatalogWhereInput {
    const where: Prisma.ItemCatalogWhereInput = {};
    if (query.builders?.length) {
      where.builder = { in: query.builders };
    }
    if (query.q) {
      where.OR = [
        { itemCode: { contains: query.q, mode: "insensitive" } },
        { partNumber: { contains: query.q, mode: "insensitive" } },
        { itemDescription: { contains: query.q, mode: "insensitive" } },
      ];
    }
    return where;
  }

  async list(query: ListItemsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(query);

    const [items, total, builders] = await this.prisma.$transaction([
      this.prisma.itemCatalog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.itemCatalog.count({ where }),
      // لیست برندهای موجود برای فیلتر multi-select در UI
      this.prisma.itemCatalog.findMany({
        where: { builder: { not: null } },
        select: { builder: true },
        distinct: ["builder"],
        orderBy: { builder: "asc" },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      builders: builders.map((b) => b.builder).filter(Boolean),
    };
  }

  /** هشدار شباهت روی کد و شرح — مشابه الگوی business_partners */
  async findSimilar(code?: string, description?: string): Promise<SimilarItem[]> {
    if (!code && !description) {
      throw new BadRequestException("حداقل یکی از code یا description لازمه");
    }

    const term = [code, description].filter(Boolean).join(" ");
    return this.prisma.$queryRaw<SimilarItem[]>`
      SELECT item_code        AS "itemCode",
             part_number      AS "partNumber",
             item_description AS "itemDescription",
             builder,
             GREATEST(similarity(part_number, ${term}), similarity(item_description, ${term})) AS similarity
      FROM item_catalog
      WHERE similarity(part_number, ${term}) > ${SIMILARITY_THRESHOLD}
         OR similarity(item_description, ${term}) > ${SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT 5
    `;
  }

  async create(dto: CreateItemDto, createdBy: string) {
    if (dto.itemCode) {
      const existing = await this.prisma.itemCatalog.findUnique({
        where: { itemCode: dto.itemCode },
      });
      if (existing) {
        throw new ConflictException("این کد کالا قبلاً ثبت شده");
      }
      return this.prisma.itemCatalog.create({
        data: { ...dto, itemCode: dto.itemCode, createdBy },
      });
    }

    // کد سیستمی ITM-NNNNNN — اتمیک با شمارنده (کد دستی هم مجازه)
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ last_serial: number }[]>`
        SELECT last_serial FROM catalog_counters WHERE id = 1 FOR UPDATE
      `;
      const serial = (rows[0]?.last_serial ?? 0) + 1;
      await tx.$executeRaw`UPDATE catalog_counters SET last_serial = ${serial} WHERE id = 1`;
      return tx.itemCatalog.create({
        data: { ...dto, itemCode: `ITM-${String(serial).padStart(6, "0")}`, createdBy },
      });
    });
  }

  // ------------------------------------------------------------
  // واحدهای اندازه‌گیری — لیست از پیش تعریف‌شده + افزودن با دسترسی
  // ------------------------------------------------------------

  listUnits() {
    return this.prisma.measurementUnit.findMany({ orderBy: { createdAt: "asc" } });
  }

  async addUnit(unitName: string) {
    const trimmed = unitName.trim();
    const existing = await this.prisma.measurementUnit.findUnique({
      where: { unitName: trimmed },
    });
    if (existing) {
      throw new ConflictException("این واحد قبلاً در لیست هست");
    }
    return this.prisma.measurementUnit.create({ data: { unitName: trimmed } });
  }

  async getByCode(itemCode: string) {
    const item = await this.prisma.itemCatalog.findUnique({
      where: { itemCode },
      include: {
        documents: {
          include: { uploader: { select: { id: true, fullName: true } } },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });
    if (!item) {
      throw new NotFoundException("کالا یافت نشد");
    }
    return item;
  }

  async update(itemCode: string, dto: UpdateItemDto) {
    await this.getByCode(itemCode);
    return this.prisma.itemCatalog.update({
      where: { itemCode },
      data: { ...dto, updatedAt: new Date() },
    });
  }

  async remove(itemCode: string) {
    await this.getByCode(itemCode);
    // وقتی دامنه ۲ (استعلام) اضافه بشه، این حذف باید قبلش چک کنه کالا در
    // inquiry_items استفاده نشده باشه؛ FK دیتابیس هم در آن صورت جلوی حذف رو می‌گیره
    await this.prisma.itemCatalog.delete({ where: { itemCode } });
    return { success: true };
  }

  // ------------------------------------------------------------
  // Import/Export اکسل — فاز ۲۵
  // ------------------------------------------------------------

  private buildWorksheet(workbook: ExcelJS.Workbook, name: string) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = EXCEL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    return sheet;
  }

  /** خروجی اکسل — همون فیلترهای q/builders لیست فعلی، بدون صفحه‌بندی (کل نتایج منطبق) */
  async export(query: Pick<ListItemsQueryDto, "q" | "builders">): Promise<Buffer> {
    const where = this.buildWhere(query);
    const items = await this.prisma.itemCatalog.findMany({ where, orderBy: { createdAt: "desc" } });

    const workbook = new ExcelJS.Workbook();
    const sheet = this.buildWorksheet(workbook, "کالاها");
    for (const item of items) {
      sheet.addRow({
        itemCode: item.itemCode,
        partNumber: item.partNumber,
        itemDescription: item.itemDescription,
        builder: item.builder ?? "",
        defaultMeasurementUnit: item.defaultMeasurementUnit ?? "",
        status: item.status === "inactive" ? "غیرفعال" : "فعال",
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** یک فایل کوچک راهنما — هدر صحیح + یک ردیف نمونه */
  async buildImportTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = this.buildWorksheet(workbook, "قالب کالاها");
    sheet.addRow({
      itemCode: "",
      partNumber: "SKF-6205",
      itemDescription: "بلبرینگ نمونه ۶۲۰۵",
      builder: "SKF",
      defaultMeasurementUnit: "عدد",
      status: "فعال",
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * درون‌ریزی اکسل — فقط ایجاد (رد کردن کد کالای تکراری)، ثبت جزئی + گزارش خطا.
   * ردیف‌ها به‌ترتیب و پشت‌سرهم پردازش می‌شن (نه موازی) تا تکرار کد کالا در همون فایل
   * هم به‌طور طبیعی توسط چک یکتایی create() شناسایی بشه.
   */
  async importFromExcel(buffer: Buffer, createdBy: string): Promise<ImportReport> {
    const workbook = new ExcelJS.Workbook();
    // cast لازمه چون تایپ‌های exceljs با نسخهٔ جدیدتر Buffer در @types/node ساختاری ناسازگارن
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("فایل اکسل خالیه یا شیت معتبری نداره");
    }

    // نگاشت نام هدر فارسی به شمارهٔ ستون — مقاوم در برابر جابه‌جایی ستون‌ها
    const headerRow = sheet.getRow(1);
    const columnIndexByKey = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const text = cellText(cell).trim();
      const match = EXCEL_COLUMNS.find((c) => c.header === text);
      if (match) columnIndexByKey.set(match.key, colNumber);
    });

    const report: ImportReport = { totalRows: 0, createdCount: 0, failedCount: 0, errors: [] };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (row.cellCount === 0) continue; // ردیف کاملاً خالی رد می‌شه، شمرده نمی‌شه

      const get = (key: string): string => {
        const idx = columnIndexByKey.get(key);
        return idx ? cellText(row.getCell(idx)) : "";
      };

      const itemCode = get("itemCode").trim();
      const partNumber = get("partNumber").trim();
      const itemDescription = get("itemDescription").trim();
      const builder = get("builder").trim();
      const defaultMeasurementUnit = get("defaultMeasurementUnit").trim();
      const statusRaw = get("status").trim();

      // ردیف کاملاً خالی (همهٔ فیلدها خالی) رد می‌شه، شمرده نمی‌شه
      if (!itemCode && !partNumber && !itemDescription && !builder && !defaultMeasurementUnit && !statusRaw) {
        continue;
      }

      report.totalRows += 1;

      try {
        if (itemDescription.length < 2) {
          throw new BadRequestException("شرح کالا الزامیه (حداقل ۲ کاراکتر)");
        }
        if (partNumber.length < 1) {
          throw new BadRequestException("پارت نامبر الزامیه");
        }
        if (itemCode && itemCode.length < 2) {
          throw new BadRequestException("کد کالا حداقل ۲ کاراکتر");
        }

        const created = await this.create(
          {
            itemCode: itemCode || undefined,
            partNumber,
            itemDescription,
            builder: builder || undefined,
            defaultMeasurementUnit: defaultMeasurementUnit || undefined,
          },
          createdBy,
        );

        if (statusRaw === "غیرفعال") {
          await this.prisma.itemCatalog.update({
            where: { itemCode: created.itemCode },
            data: { status: "inactive" },
          });
        }

        report.createdCount += 1;
      } catch (error) {
        report.failedCount += 1;
        const message =
          error instanceof ConflictException || error instanceof BadRequestException
            ? error.message
            : "خطای غیرمنتظره در ثبت این ردیف";
        report.errors.push({ row: rowNumber, itemCode: itemCode || undefined, message });
      }
    }

    return report;
  }

  // ------------------------------------------------------------
  // پیوست فایل در سطح کالا — فاز ۲۵
  // ------------------------------------------------------------

  async addDocument(itemCode: string, dto: AddCatalogDocumentDto, uploadedBy: string) {
    await this.getByCode(itemCode);
    return this.prisma.itemCatalogDocument.create({
      data: { itemCode, fileUrl: dto.fileUrl, fileName: dto.fileName, uploadedBy },
    });
  }

  async removeDocument(id: string) {
    const document = await this.prisma.itemCatalogDocument.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException("سند یافت نشد");
    }
    await this.prisma.itemCatalogDocument.delete({ where: { id } });
    return { success: true };
  }
}
