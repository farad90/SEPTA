import { DependencyEngineService } from "../dependency-engine/dependency-engine.service";
import { FormulaEngineService } from "../formula-engine/formula-engine.service";
import { ComponentEvaluationError } from "./errors";
import { ComponentEvaluatorService } from "./component-evaluator.service";
import { ComponentDefinition } from "./types";

function service() {
  const formulaEngine = new FormulaEngineService();
  const dependencyEngine = new DependencyEngineService(formulaEngine);
  return new ComponentEvaluatorService(formulaEngine, dependencyEngine);
}

function component(overrides: Partial<ComponentDefinition> & { code: string }): ComponentDefinition {
  return {
    id: overrides.code,
    componentType: "earning",
    isInsurable: true,
    isTaxable: true,
    calcOrder: 0,
    formulaExpression: null,
    ...overrides,
  };
}

describe("ComponentEvaluatorService", () => {
  it("اجزای بدون فرمول را صفر محاسبه می‌کند", () => {
    const svc = service();
    const result = svc.evaluate("v1", [component({ code: "OTHER", formulaExpression: null })], {});
    expect(result).toEqual([
      expect.objectContaining({ code: "OTHER", amount: 0, formulaSnapshot: null }),
    ]);
  });

  it("یک زنجیره‌ی وابسته را به ترتیب صحیح حساب می‌کند (GROSS از BASE+HOUSE)", () => {
    const svc = service();
    const components = [
      component({ code: "BASE", formulaExpression: "BASE_SALARY" }),
      component({ code: "HOUSE", formulaExpression: "PERCENT(BASE, HOUSE_RATE)" }),
      component({ code: "GROSS", formulaExpression: "BASE + HOUSE" }),
    ];
    const result = svc.evaluate("v1", components, { BASE_SALARY: 1000, HOUSE_RATE: 20 });

    const byCode = Object.fromEntries(result.map((r) => [r.code, r.amount]));
    expect(byCode.BASE).toBe(1000);
    expect(byCode.HOUSE).toBe(200);
    expect(byCode.GROSS).toBe(1200);
  });

  it("formulaSnapshot را دقیقاً برابر متن فرمول در لحظه‌ی محاسبه ذخیره می‌کند", () => {
    const svc = service();
    const result = svc.evaluate("v1", [component({ code: "BASE", formulaExpression: "BASE_SALARY" })], {
      BASE_SALARY: 500,
    });
    expect(result[0].formulaSnapshot).toBe("BASE_SALARY");
  });

  it("وقتی فرمول یک متغیر برگ ناموجود بخواهد، ComponentEvaluationError با کد جزء می‌دهد", () => {
    const svc = service();
    expect(() =>
      svc.evaluate("v1", [component({ code: "BASE", formulaExpression: "MISSING_VAR" })], {}),
    ).toThrow(ComponentEvaluationError);
  });

  it("وقتی فرمول مقدار boolean برمی‌گرداند (نه عدد)، خطای واضح می‌دهد", () => {
    const svc = service();
    expect(() =>
      svc.evaluate("v1", [component({ code: "FLAG", formulaExpression: "1 > 0" })], {}),
    ).toThrow(ComponentEvaluationError);
  });

  it("وابستگی چرخه‌ای بین دو جزء را (از طریق Dependency Engine) شناسایی و پرتاب می‌کند", () => {
    const svc = service();
    const components = [
      component({ code: "A", formulaExpression: "B + 1" }),
      component({ code: "B", formulaExpression: "A + 1" }),
    ];
    expect(() => svc.evaluate("v1", components, {})).toThrow();
  });

  it("مقدار محاسبه‌شده‌ی یک جزء را در Context برای اجزای بعدی در دسترس می‌گذارد (نه فقط ورودی‌های اولیه)", () => {
    const svc = service();
    const components = [
      component({ code: "A", formulaExpression: "10" }),
      component({ code: "B", formulaExpression: "A * 2" }),
    ];
    const result = svc.evaluate("v1", components, {});
    expect(result.find((r) => r.code === "B")?.amount).toBe(20);
  });
});
