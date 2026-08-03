import { PayrollDocumentsService } from "./payroll-documents.service";

const PAYSLIP_DATA = {
  resultId: "result-1",
  periodCode: "1406-01",
  status: "calculated",
  employeeName: "حسین نوری",
  employeeNumber: "EMP-01",
  positionTitle: "مدیر",
  departmentName: "مدیریت",
  ourEntity: { entityName: "پولاد تجهیز آپادانا", address: "تهران", phone: "021", email: "a@b.com", logoUrl: null },
  currencyCode: "IRR",
  items: [],
  grossEarnings: 65_000_000,
  insuranceEmployeeShare: 4_200_000,
  insuranceEmployerShare: 13_800_000,
  unemploymentInsurance: 1_800_000,
  taxAmount: 9_160_000,
  otherDeductions: 1_500_000,
  totalDeductions: 14_860_000,
  netSalary: 50_140_000,
  employerCost: 80_600_000,
};

function buildDeps() {
  const payslipData = { getPayslipData: jest.fn().mockResolvedValue(PAYSLIP_DATA) } as any;
  const pdfRenderer = { renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("pdf-bytes")) } as any;
  const payrollListExcel = {
    render: jest.fn().mockResolvedValue({ buffer: Buffer.from("xlsx-bytes"), periodCode: "1406-01" }),
  } as any;
  const storage = {
    save: jest.fn().mockImplementation((fileName: string) => Promise.resolve({ fileUrl: `/uploads/${fileName}`, fileName })),
    readBuffer: jest.fn().mockResolvedValue(Buffer.from("logo-bytes")),
  } as any;
  return { payslipData, pdfRenderer, payrollListExcel, storage };
}

function buildService(deps: ReturnType<typeof buildDeps>) {
  return new PayrollDocumentsService(deps.payslipData, deps.pdfRenderer, deps.payrollListExcel, deps.storage);
}

describe("PayrollDocumentsService.generatePayslipPdf", () => {
  it("HTML را می‌سازد، به PDF رندر می‌کند و با نام فایل مبتنی بر دوره/شماره‌پرسنلی ذخیره می‌کند", async () => {
    const deps = buildDeps();
    const service = buildService(deps);

    const result = await service.generatePayslipPdf("result-1");

    expect(deps.payslipData.getPayslipData).toHaveBeenCalledWith("result-1");
    expect(deps.pdfRenderer.renderHtmlToPdf).toHaveBeenCalledWith(expect.stringContaining("حسین نوری"));
    expect(deps.storage.save).toHaveBeenCalledWith("payslip-1406-01-EMP-01.pdf", expect.any(Buffer));
    expect(result).toEqual({ fileUrl: "/uploads/payslip-1406-01-EMP-01.pdf", fileName: "payslip-1406-01-EMP-01.pdf" });
  });

  it("وقتی سازمان لوگو نداشته باشد، readBuffer صدا زده نمی‌شود", async () => {
    const deps = buildDeps();
    const service = buildService(deps);

    await service.generatePayslipPdf("result-1");

    expect(deps.storage.readBuffer).not.toHaveBeenCalled();
  });

  it("وقتی سازمان لوگو داشته باشد، آن را می‌خواند و به‌صورت data URI در HTML جاسازی می‌کند", async () => {
    const deps = buildDeps();
    deps.payslipData.getPayslipData.mockResolvedValue({
      ...PAYSLIP_DATA,
      ourEntity: { ...PAYSLIP_DATA.ourEntity, logoUrl: "/uploads/logo.png" },
    });
    const service = buildService(deps);

    await service.generatePayslipPdf("result-1");

    expect(deps.storage.readBuffer).toHaveBeenCalledWith("/uploads/logo.png");
    expect(deps.pdfRenderer.renderHtmlToPdf).toHaveBeenCalledWith(expect.stringContaining("data:image/png;base64,"));
  });
});

describe("PayrollDocumentsService.generatePayrollListExcel", () => {
  it("فایل اکسل لیست حقوق را با نام مبتنی بر کد دوره ذخیره می‌کند", async () => {
    const deps = buildDeps();
    const service = buildService(deps);

    const result = await service.generatePayrollListExcel("period-1");

    expect(deps.payrollListExcel.render).toHaveBeenCalledWith("period-1");
    expect(deps.storage.save).toHaveBeenCalledWith("payroll-list-1406-01.xlsx", expect.any(Buffer));
    expect(result.fileUrl).toBe("/uploads/payroll-list-1406-01.xlsx");
  });
});
