import { Injectable } from "@nestjs/common";
import { extname } from "path";
import { ProposalService } from "../proposal/proposal.service";
import { StorageService } from "../files/storage.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { ExcelRendererService } from "./excel-renderer.service";
import { buildProposalHtml, ProposalDocLang } from "./html-template.builder";
import { generateBarcodeDataUri, generateBarcodePng } from "./barcode.helper";

const EXCEL_IMAGE_TYPES: Record<string, "png" | "jpeg" | "gif"> = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".gif": "gif",
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

export type ProposalDocKind = "financial" | "technical";
export type ProposalDocFormat = "pdf" | "xlsx";

@Injectable()
export class ProposalDocumentsService {
  constructor(
    private readonly proposalService: ProposalService,
    private readonly storage: StorageService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly excelRenderer: ExcelRendererService,
  ) {}

  async generate(
    inquiryId: string,
    kind: ProposalDocKind,
    format: ProposalDocFormat,
    lang: ProposalDocLang,
    deliveryOptionId?: string,
  ): Promise<{ fileUrl: string; fileName: string }> {
    const data = await this.proposalService.getDocumentData(inquiryId, kind, deliveryOptionId);
    const logoUrl = data.ourEntity?.logoUrl ?? null;
    const ext = logoUrl ? extname(logoUrl).toLowerCase() : null;
    const logoBuffer = logoUrl ? await this.storage.readBuffer(logoUrl).catch(() => null) : null;

    // فاز ۴۰-گ: بارکد Code128 روی شماره پیشنهاد — هم برای PDF (تصویر HTML) هم اکسل (تصویر Embed‌شده)
    const barcodePng = await generateBarcodePng(data.proposalNumber);

    // فاز ۴۹ — نام قابل‌تشخیص هم برای دانلود (fileName نمایشی) هم برای فایل فیزیکی روی دیسک
    // (preferredBaseName، پاکسازی‌شده در StorageService)؛ هر دو بر مبنای «Commercial/Technical Offer»
    // + شماره پیشنهاد، طبق درخواست کاربر — نه صرفاً شماره خام.
    const kindLabel = kind === "financial" ? "Commercial Offer" : "Technical Offer";
    // فاز ۶۰ — وقتی سند مخصوص یک گزینه‌ی ترم تحویل خاصه، ترم توی نام فایل هم مشخص می‌شه
    // تا کاربر بین «Commercial Offer X-CPT» و «...-DDP» گم نشه
    const termSuffix = deliveryOptionId && data.chosenDeliveryTerm ? `-${data.chosenDeliveryTerm}` : "";
    const baseName = `${kindLabel} ${data.proposalNumber}${termSuffix}-${lang}`;

    let buffer: Buffer;
    let fileName: string;
    if (format === "pdf") {
      const logoDataUri =
        logoBuffer && ext && MIME_BY_EXT[ext] ? `data:${MIME_BY_EXT[ext]};base64,${logoBuffer.toString("base64")}` : null;
      const barcodeDataUri = await generateBarcodeDataUri(data.proposalNumber);
      const html = buildProposalHtml(data, lang, logoDataUri, barcodeDataUri);
      buffer = await this.pdfRenderer.renderHtmlToPdf(html);
      fileName = `${baseName}.pdf`;
    } else {
      // فایل اکسل فقط از فرمت‌های شناخته‌شده (نه webp/bmp) لوگو رو Embed می‌کنه؛ بقیه فقط نام شرکت متنی
      const excelImageType = ext ? EXCEL_IMAGE_TYPES[ext] : undefined;
      const logo = logoBuffer && excelImageType ? { buffer: logoBuffer, extension: excelImageType } : null;
      buffer = await this.excelRenderer.render(data, lang, logo, barcodePng);
      fileName = `${baseName}.xlsx`;
    }

    const stored = await this.storage.save(fileName, buffer, {
      folderHint: data.internalNumber,
      preferredBaseName: `${kindLabel}-${data.proposalNumber}${termSuffix}-${lang}`,
    });

    // فاز ۶۰ — fileUrl تک‌مقداره روی خود پیشنهاد فقط برای مسیر قدیمی/تک‌گزینه‌ای معنا داره؛
    // وقتی سند مخصوص یک گزینه‌ی خاص تولید می‌شه، این فیلد رو بازنویسی نمی‌کنیم (چند گزینه
    // ممکنه هم‌زمان سند داشته باشن، یکی نباید جای بقیه رو بگیره)
    if (!deliveryOptionId) {
      if (kind === "financial") {
        await this.proposalService.setFinancialFile(inquiryId, stored.fileUrl);
      } else {
        await this.proposalService.setTechnicalFile(inquiryId, stored.fileUrl);
      }
    }

    return { fileUrl: stored.fileUrl, fileName };
  }
}
