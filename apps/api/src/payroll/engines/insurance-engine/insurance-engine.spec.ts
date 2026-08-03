import { RuleSet } from "../rule-engine/rule-set.types";
import { InsuranceEngineService } from "./insurance-engine.service";

function ruleSet(values: Record<string, number>): RuleSet {
  return { ruleVersionId: "v1", values, brackets: [] };
}

describe("InsuranceEngineService", () => {
  const service = new InsuranceEngineService();

  it("سهم کارگر/کارفرما/بیکاری را طبق نرخ‌های RuleSet محاسبه می‌کند", () => {
    const result = service.calculate(1000, ruleSet({
      INSURANCE_RATE_EMPLOYEE: 7,
      INSURANCE_RATE_EMPLOYER: 23,
      UNEMPLOYMENT_RATE: 3,
      INSURANCE_CEILING: 10000,
    }));

    expect(result.insuranceBase).toBe(1000);
    expect(result.employeeShare).toBeCloseTo(70);
    expect(result.employerShare).toBeCloseTo(230);
    expect(result.unemploymentShare).toBeCloseTo(30);
    expect(result.total).toBeCloseTo(330);
  });

  it("سقف بیمه را اعمال می‌کند — طبق نمونه‌ی طراحی MIN(base*rate, ceiling)", () => {
    const result = service.calculate(5000, ruleSet({
      INSURANCE_RATE_EMPLOYEE: 7,
      INSURANCE_RATE_EMPLOYER: 23,
      UNEMPLOYMENT_RATE: 3,
      INSURANCE_CEILING: 2000,
    }));

    expect(result.insuranceBase).toBe(2000); // سقف اعمال شده، نه 5000
    expect(result.employeeShare).toBeCloseTo(140);
  });

  it("بدون سقف تعریف‌شده، مبنا محدود نمی‌شود", () => {
    const result = service.calculate(5000, ruleSet({ INSURANCE_RATE_EMPLOYEE: 7 }));
    expect(result.insuranceBase).toBe(5000);
  });

  it("مبنای منفی به صفر محدود می‌شود", () => {
    const result = service.calculate(-100, ruleSet({ INSURANCE_RATE_EMPLOYEE: 7 }));
    expect(result.insuranceBase).toBe(0);
    expect(result.employeeShare).toBe(0);
  });

  it("نرخ‌های تعریف‌نشده در RuleSet صفر فرض می‌شوند (نه خطا)", () => {
    const result = service.calculate(1000, ruleSet({}));
    expect(result.total).toBe(0);
  });
});
