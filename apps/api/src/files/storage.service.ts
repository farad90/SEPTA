import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createReadStream } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { extname, join, normalize } from "path";
import { randomUUID } from "crypto";
import type { Readable } from "stream";

export interface StoredFile {
  /** مسیر نسبی داخل storage — همینه که در ستون‌های file_url ذخیره می‌شه */
  fileUrl: string;
  fileName: string;
}

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".dwg",
  ".xlsx",
  ".docx",
  ".zip",
  ".tif",
  ".tiff",
]);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // ۲۰ مگابایت

/** پاکسازی یک بخش مسیر/نام فایل — فقط حروف لاتین/عدد/خط‌تیره/زیرخط مجازه (امنیت مسیر + خوانایی روی دیسک) */
function sanitizeSegment(input: string, maxLength = 80): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, maxLength) || "file";
}

/**
 * لایه انتزاعی ذخیره فایل — driver فعلی: دیسک لوکال (تصمیم فاز ۳).
 * مهاجرت آتی به MinIO/S3 فقط این کلاس رو عوض می‌کنه؛ ماژول‌ها فقط fileUrl نگه می‌دارن.
 */
@Injectable()
export class StorageService {
  private readonly rootDir = join(process.cwd(), "uploads");

  validate(originalName: string, size: number): void {
    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`فرمت فایل مجاز نیست (${ext || "بدون پسوند"})`);
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("حجم فایل بیشتر از ۲۰ مگابایته");
    }
  }

  /**
   * @param options.folderHint — مثلاً شماره داخلی استعلام (INQ-2026-0028)؛ اگه پر باشه فایل‌های
   * همون پرونده در یک پوشه‌ی مشترک (نه بر مبنای سال/ماه) ذخیره می‌شن.
   * @param options.preferredBaseName — نام قابل‌تشخیص برای فایل تولیدی (مثلاً Commercial-Offer-...)
   * به‌جای UUID خام؛ همیشه با یک شناسه کوتاه یکتا ترکیب می‌شه تا تصادم اسم پیش نیاد.
   */
  async save(
    originalName: string,
    buffer: Buffer,
    options?: { folderHint?: string; preferredBaseName?: string },
  ): Promise<StoredFile> {
    this.validate(originalName, buffer.length);

    const ext = extname(originalName).toLowerCase();
    const shortId = randomUUID().slice(0, 8);
    const storedName = options?.preferredBaseName
      ? `${sanitizeSegment(options.preferredBaseName)}-${shortId}${ext}`
      : `${randomUUID()}${ext}`;

    let relativeDir: string;
    let urlPrefix: string;
    if (options?.folderHint) {
      relativeDir = sanitizeSegment(options.folderHint);
      urlPrefix = relativeDir;
    } else {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      relativeDir = join(year, month);
      urlPrefix = `${year}/${month}`;
    }
    const absoluteDir = join(this.rootDir, relativeDir);

    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, storedName), buffer);

    return {
      fileUrl: `${urlPrefix}/${storedName}`,
      fileName: originalName,
    };
  }

  openStream(fileUrl: string): { stream: Readable; absolutePath: string } {
    // جلوگیری از Path Traversal — مسیر باید داخل uploads بمونه
    const absolutePath = normalize(join(this.rootDir, fileUrl));
    if (!absolutePath.startsWith(this.rootDir)) {
      throw new BadRequestException("مسیر فایل نامعتبره");
    }
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("فایل یافت نشد");
    }
    return { stream: createReadStream(absolutePath), absolutePath };
  }

  /** برای Embed کردن فایل (مثلاً لوگو) داخل سند تولیدی — نه Stream، مستقیم Buffer */
  async readBuffer(fileUrl: string): Promise<Buffer> {
    const { absolutePath } = this.openStream(fileUrl);
    return readFile(absolutePath);
  }

  async remove(fileUrl: string): Promise<void> {
    const absolutePath = normalize(join(this.rootDir, fileUrl));
    if (!absolutePath.startsWith(this.rootDir) || !existsSync(absolutePath)) {
      return; // حذف فایل گم‌شده خطا نیست — رکورد دیتابیس مرجع اصلیه
    }
    await unlink(absolutePath);
  }
}
