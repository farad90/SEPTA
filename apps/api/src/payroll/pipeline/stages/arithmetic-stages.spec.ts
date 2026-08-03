import { ComponentEvaluationResult } from "../../engines/component-evaluator/types";
import { PayrollPipelineContext } from "../pipeline-context";
import { CalculateEarningsStage } from "./05-calculate-earnings.stage";
import { CalculateInsuranceBaseStage } from "./06-calculate-insurance-base.stage";
import { CalculateTaxableIncomeStage } from "./08-calculate-taxable-income.stage";
import { OtherDeductionsStage } from "./10-other-deductions.stage";
import { NetSalaryStage } from "./11-net-salary.stage";
import { EmployerCostStage } from "./12-employer-cost.stage";

function item(overrides: Partial<ComponentEvaluationResult> & { code: string }): ComponentEvaluationResult {
  return {
    componentId: overrides.code,
    componentType: "earning",
    isInsurable: false,
    isTaxable: false,
    calcOrder: 0,
    amount: 0,
    formulaSnapshot: null,
    ...overrides,
  };
}

function baseCtx(componentResults: ComponentEvaluationResult[]): PayrollPipelineContext {
  return { payrollPeriodId: "p1", employeeId: "e1", componentResults };
}

describe("CalculateEarningsStage", () => {
  it("فقط اجزای earning را جمع می‌زند، deduction را نادیده می‌گیرد", async () => {
    const ctx = baseCtx([
      item({ code: "BASE", componentType: "earning", amount: 1000 }),
      item({ code: "HOUSE", componentType: "earning", amount: 200 }),
      item({ code: "LOAN", componentType: "deduction", amount: 100 }),
    ]);
    await new CalculateEarningsStage().execute(ctx);
    expect(ctx.grossEarnings).toBe(1200);
  });
});

describe("CalculateInsuranceBaseStage", () => {
  it("فقط اجزای isInsurable=true را جمع می‌زند", async () => {
    const ctx = baseCtx([
      item({ code: "BASE", amount: 1000, isInsurable: true }),
      item({ code: "BONUS", amount: 300, isInsurable: false }),
    ]);
    await new CalculateInsuranceBaseStage().execute(ctx);
    expect(ctx.insuranceBase).toBe(1000);
  });
});

describe("CalculateTaxableIncomeStage", () => {
  it("جمع اجزای isTaxable منهای سهم بیمه‌ی کارگر را محاسبه می‌کند", async () => {
    const ctx = baseCtx([
      item({ code: "BASE", amount: 1000, isTaxable: true }),
      item({ code: "HOUSE", amount: 200, isTaxable: true }),
    ]);
    ctx.insuranceResult = {
      insuranceBase: 1000,
      employeeShare: 70,
      employerShare: 230,
      unemploymentShare: 30,
      total: 330,
    };
    await new CalculateTaxableIncomeStage().execute(ctx);
    expect(ctx.taxableIncome).toBe(1130); // 1200 - 70
  });

  it("هرگز منفی نمی‌شود", async () => {
    const ctx = baseCtx([item({ code: "BASE", amount: 50, isTaxable: true })]);
    ctx.insuranceResult = { insuranceBase: 50, employeeShare: 100, employerShare: 0, unemploymentShare: 0, total: 100 };
    await new CalculateTaxableIncomeStage().execute(ctx);
    expect(ctx.taxableIncome).toBe(0);
  });
});

describe("OtherDeductionsStage", () => {
  it("کسورات را جمع می‌زند ولی INSURANCE/TAX را کنار می‌گذارد (دوبار حساب نشود)", async () => {
    const ctx = baseCtx([
      item({ code: "LOAN", componentType: "deduction", amount: 500 }),
      item({ code: "ADVANCE", componentType: "deduction", amount: 200 }),
      item({ code: "INSURANCE", componentType: "deduction", amount: 999 }),
      item({ code: "TAX", componentType: "deduction", amount: 999 }),
      item({ code: "BASE", componentType: "earning", amount: 1000 }),
    ]);
    await new OtherDeductionsStage().execute(ctx);
    expect(ctx.otherDeductions).toBe(700);
  });
});

describe("NetSalaryStage", () => {
  it("خالص = ناخالص - بیمه کارگر - مالیات - سایر کسورات", async () => {
    const ctx = baseCtx([]);
    ctx.grossEarnings = 1200;
    ctx.insuranceResult = { insuranceBase: 1000, employeeShare: 70, employerShare: 230, unemploymentShare: 30, total: 330 };
    ctx.taxAmount = 50;
    ctx.otherDeductions = 30;
    await new NetSalaryStage().execute(ctx);
    expect(ctx.netSalary).toBe(1050); // 1200-70-50-30
  });
});

describe("EmployerCostStage", () => {
  it("هزینه‌ی کارفرما = ناخالص + سهم بیمه‌ی کارفرما + بیمه‌ی بیکاری", async () => {
    const ctx = baseCtx([]);
    ctx.grossEarnings = 1200;
    ctx.insuranceResult = { insuranceBase: 1000, employeeShare: 70, employerShare: 230, unemploymentShare: 30, total: 330 };
    await new EmployerCostStage().execute(ctx);
    expect(ctx.employerCost).toBe(1460); // 1200+230+30
  });
});
