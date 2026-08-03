import ExcelJS from "exceljs";
import { NotFoundException } from "@nestjs/common";
import { PayrollPeriodRepository } from "../repositories/payroll-period.repository";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { PayrollListExcelService } from "./payroll-list-excel.service";

function buildRepos(period: unknown, results: unknown[]) {
  const periodRepository = {
    findById: jest.fn().mockResolvedValue(period),
  } as unknown as jest.Mocked<PayrollPeriodRepository>;
  const resultRepository = {
    listByPeriod: jest.fn().mockResolvedValue(results),
  } as unknown as jest.Mocked<PayrollResultRepository>;
  return { periodRepository, resultRepository };
}

const RESULT_ROW = {
  employeeId: "emp-1",
  employee: { employeeNumber: "EMP-01", fullName: "حسین نوری" },
  grossEarnings: "65000000",
  insuranceEmployeeShare: "4200000",
  insuranceEmployerShare: "13800000",
  unemploymentInsurance: "1800000",
  taxAmount: "9160000",
  totalDeductions: "14860000",
  netSalary: "50140000",
  employerCost: "80600000",
  status: "locked",
};

describe("PayrollListExcelService.render", () => {
  it("وقتی دوره پیدا نشود، NotFoundException می‌دهد", async () => {
    const { periodRepository, resultRepository } = buildRepos(null, []);
    const service = new PayrollListExcelService(periodRepository, resultRepository);
    await expect(service.render("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("یک فایل اکسل معتبر با یک ردیف به‌ازای هر نتیجه می‌سازد", async () => {
    const { periodRepository, resultRepository } = buildRepos({ periodCode: "1406-01" }, [RESULT_ROW]);
    const service = new PayrollListExcelService(periodRepository, resultRepository);

    const { buffer, periodCode } = await service.render("period-1");
    expect(periodCode).toBe("1406-01");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet("لیست حقوق");
    expect(sheet).toBeDefined();
    // ردیف ۱ = سربرگ، ردیف ۲ = اولین نتیجه
    expect(sheet!.getRow(2).getCell(1).value).toBe("EMP-01");
    expect(sheet!.getRow(2).getCell(2).value).toBe("حسین نوری");
    expect(sheet!.getRow(2).getCell(9).value).toBe(50_140_000); // خالص پرداختی
  });

  it("سایر کسورات را برای هر ردیف صحیح محاسبه می‌کند", async () => {
    const { periodRepository, resultRepository } = buildRepos({ periodCode: "1406-01" }, [RESULT_ROW]);
    const service = new PayrollListExcelService(periodRepository, resultRepository);

    const { buffer } = await service.render("period-1");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet("لیست حقوق")!;
    // otherDeductions = 14,860,000 - 4,200,000 - 9,160,000 = 1,500,000
    expect(sheet.getRow(2).getCell(8).value).toBe(1_500_000);
  });
});
