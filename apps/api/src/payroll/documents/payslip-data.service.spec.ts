import { NotFoundException } from "@nestjs/common";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { PayslipDataService } from "./payslip-data.service";

function buildRepo(result: unknown) {
  return {
    findByIdForDocument: jest.fn().mockResolvedValue(result),
  } as unknown as jest.Mocked<PayrollResultRepository>;
}

const BASE_RESULT = {
  id: "result-1",
  status: "calculated",
  grossEarnings: "65000000",
  insuranceEmployeeShare: "4200000",
  insuranceEmployerShare: "13800000",
  unemploymentInsurance: "1800000",
  taxAmount: "9160000",
  totalDeductions: "14860000",
  netSalary: "50140000",
  employerCost: "80600000",
  payrollPeriod: { periodCode: "1406-01" },
  employee: {
    fullName: "حسین نوری",
    employeeNumber: "EMP-01",
    positionTitle: "مدیر",
    department: { departmentName: "مدیریت" },
    ourEntity: { entityName: "پولاد تجهیز آپادانا", address: "تهران", phone: "021", email: "a@b.com", logoUrl: null },
    contracts: [{ salaryCurrency: "IRR" }],
  },
  items: [
    { componentCode: "BASE", amount: "50000000", component: { title: "حقوق پایه", componentType: "earning" } },
    { componentCode: "HOUSE", amount: "10000000", component: { title: "حق مسکن", componentType: "earning" } },
    { componentCode: "OVERTIME", amount: "5000000", component: { title: "اضافه‌کاری", componentType: "earning" } },
    { componentCode: "LOAN", amount: "1500000", component: { title: "قسط وام", componentType: "deduction" } },
  ],
};

describe("PayslipDataService.getPayslipData", () => {
  it("وقتی نتیجه پیدا نشود، NotFoundException می‌دهد", async () => {
    const service = new PayslipDataService(buildRepo(null));
    await expect(service.getPayslipData("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("مقادیر Decimal (رشته‌ای) را به عدد تبدیل می‌کند و زمینه‌ی کارمند/سازمان را می‌سازد", async () => {
    const service = new PayslipDataService(buildRepo(BASE_RESULT));
    const data = await service.getPayslipData("result-1");

    expect(data.employeeName).toBe("حسین نوری");
    expect(data.periodCode).toBe("1406-01");
    expect(data.currencyCode).toBe("IRR");
    expect(data.grossEarnings).toBe(65_000_000);
    expect(data.netSalary).toBe(50_140_000);
  });

  it("کدهای INSURANCE/TAX را از لیست اجزای نمایشی کنار می‌گذارد (روی ستون‌های اختصاصی نمایش داده می‌شوند)", async () => {
    const withEngineManaged = {
      ...BASE_RESULT,
      items: [
        ...BASE_RESULT.items,
        { componentCode: "INSURANCE", amount: "4200000", component: { title: "بیمه", componentType: "deduction" } },
        { componentCode: "TAX", amount: "9160000", component: { title: "مالیات", componentType: "deduction" } },
      ],
    };
    const service = new PayslipDataService(buildRepo(withEngineManaged));
    const data = await service.getPayslipData("result-1");

    expect(data.items.map((i) => i.code)).toEqual(["BASE", "HOUSE", "OVERTIME", "LOAN"]);
  });

  it("سایر کسورات را از تفریق سهم بیمه/مالیات از جمع کل کسورات محاسبه می‌کند", async () => {
    const service = new PayslipDataService(buildRepo(BASE_RESULT));
    const data = await service.getPayslipData("result-1");
    // 14,860,000 - 4,200,000 - 9,160,000 = 1,500,000 (LOAN)
    expect(data.otherDeductions).toBe(1_500_000);
  });

  it("وقتی کارمند فاقد قرارداد فعال باشد، پیش‌فرض ارز IRR را برمی‌گرداند", async () => {
    const noContract = { ...BASE_RESULT, employee: { ...BASE_RESULT.employee, contracts: [] } };
    const service = new PayslipDataService(buildRepo(noContract));
    const data = await service.getPayslipData("result-1");
    expect(data.currencyCode).toBe("IRR");
  });
});
