import { Injectable } from "@nestjs/common";
import { extname } from "path";
import { StorageService } from "../../files/storage.service";
import { PdfRendererService } from "../../proposal-documents/pdf-renderer.service";
import { PayslipDataService } from "./payslip-data.service";
import { buildPayslipHtml } from "./payslip-html.builder";
import { PayrollListExcelService } from "./payroll-list-excel.service";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Reporting/Document Engine — به‌جای زیرساخت موازی، از همان PdfRendererService (Puppeteer)
 * و StorageService پروژه‌ی «proposal-documents» استفاده می‌کند؛ فقط قالب HTML/Excel مخصوص
 * حقوق (که محتوایش کاملاً متفاوت از پیشنهاد مشتریه) تازه نوشته شده.
 */
@Injectable()
export class PayrollDocumentsService {
  constructor(
    private readonly payslipData: PayslipDataService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly payrollListExcel: PayrollListExcelService,
    private readonly storage: StorageService,
  ) {}

  async generatePayslipPdf(resultId: string): Promise<{ fileUrl: string; fileName: string }> {
    const data = await this.payslipData.getPayslipData(resultId);

    const logoUrl = data.ourEntity?.logoUrl ?? null;
    const ext = logoUrl ? extname(logoUrl).toLowerCase() : null;
    const logoBuffer = logoUrl ? await this.storage.readBuffer(logoUrl).catch(() => null) : null;
    const logoDataUri =
      logoBuffer && ext && MIME_BY_EXT[ext] ? `data:${MIME_BY_EXT[ext]};base64,${logoBuffer.toString("base64")}` : null;

    const html = buildPayslipHtml(data, logoDataUri);
    const buffer = await this.pdfRenderer.renderHtmlToPdf(html);
    const fileName = `payslip-${data.periodCode}-${data.employeeNumber}.pdf`;

    return this.storage.save(fileName, buffer);
  }

  async generatePayrollListExcel(periodId: string): Promise<{ fileUrl: string; fileName: string }> {
    const { buffer, periodCode } = await this.payrollListExcel.render(periodId);
    const fileName = `payroll-list-${periodCode}.xlsx`;
    return this.storage.save(fileName, buffer);
  }
}
