import { Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PayrollPeriodRepository } from "../repositories/payroll-period.repository";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";

const STATUS_LABEL: Record<string, string> = {
  draft: "پیش‌نویس",
  calculated: "محاسبه‌شده",
  reviewed: "بازبینی‌شده",
  approved: "تأییدشده",
  posted: "ثبت حسابداری",
  locked: "قفل‌شده",
};

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };

/** گزارش «لیست حقوق» یک دوره — جمع‌بندی تک‌ردیفه‌ی هر کارمند، برای حسابداری/مدیریت. */
@Injectable()
export class PayrollListExcelService {
  constructor(
    private readonly periodRepository: PayrollPeriodRepository,
    private readonly resultRepository: PayrollResultRepository,
  ) {}

  async render(periodId: string): Promise<{ buffer: Buffer; periodCode: string }> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) throw new NotFoundException("دوره‌ی حقوقی یافت نشد");

    const results = await this.resultRepository.listByPeriod(periodId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("لیست حقوق", { views: [{ rightToLeft: true }] });
    sheet.columns = [
      { header: "شماره پرسنلی", key: "employeeNumber", width: 14 },
      { header: "نام و نام‌خانوادگی", key: "fullName", width: 24 },
      { header: "ناخالص", key: "gross", width: 16 },
      { header: "سهم بیمه کارگر", key: "insuranceEmployee", width: 16 },
      { header: "سهم بیمه کارفرما", key: "insuranceEmployer", width: 16 },
      { header: "بیمه بیکاری", key: "unemployment", width: 14 },
      { header: "مالیات", key: "tax", width: 14 },
      { header: "سایر کسورات", key: "otherDeductions", width: 14 },
      { header: "خالص پرداختی", key: "net", width: 16 },
      { header: "هزینه‌ی کارفرما", key: "employerCost", width: 16 },
      { header: "وضعیت", key: "status", width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    for (const result of results) {
      const otherDeductions =
        Number(result.totalDeductions) - Number(result.insuranceEmployeeShare) - Number(result.taxAmount);
      sheet.addRow({
        employeeNumber: result.employee?.employeeNumber ?? "—",
        fullName: result.employee?.fullName ?? result.employeeId,
        gross: Number(result.grossEarnings),
        insuranceEmployee: Number(result.insuranceEmployeeShare),
        insuranceEmployer: Number(result.insuranceEmployerShare),
        unemployment: Number(result.unemploymentInsurance),
        tax: Number(result.taxAmount),
        otherDeductions,
        net: Number(result.netSalary),
        employerCost: Number(result.employerCost),
        status: STATUS_LABEL[result.status] ?? result.status,
      });
    }

    for (const key of ["gross", "insuranceEmployee", "insuranceEmployer", "unemployment", "tax", "otherDeductions", "net", "employerCost"]) {
      sheet.getColumn(key).numFmt = "#,##0";
    }

    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), periodCode: period.periodCode };
  }
}
