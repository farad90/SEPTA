import { readFileSync } from "fs";
import { join } from "path";
import { FormulaEvaluationError, FormulaSyntaxError } from "./errors";
import { FormulaEvaluator } from "./evaluator";
import { FormulaParser } from "./parser";

function evalExpr(expression: string, ctx: Record<string, number | boolean> = {}) {
  const parser = new FormulaParser();
  const evaluator = new FormulaEvaluator();
  return evaluator.evaluate(parser.parse(expression), ctx);
}

describe("FormulaParser + FormulaEvaluator — گرامر پایه", () => {
  it("عدد ساده", () => {
    expect(evalExpr("42")).toBe(42);
  });

  it("عدد اعشاری", () => {
    expect(evalExpr("3.5")).toBe(3.5);
  });

  it("متغیر از Context خوانده می‌شود", () => {
    expect(evalExpr("BASE", { BASE: 1000 })).toBe(1000);
  });

  it("نام متغیر case-insensitive به بزرگ نرمال می‌شود", () => {
    expect(evalExpr("base", { BASE: 500 })).toBe(500);
  });

  it("جمع سه‌جزئی (تداعی BASE + HOUSE + FOOD از طراحی)", () => {
    expect(evalExpr("BASE + HOUSE + FOOD", { BASE: 100, HOUSE: 20, FOOD: 10 })).toBe(130);
  });

  it("اولویت ضرب/تقسیم بر جمع/تفریق", () => {
    expect(evalExpr("2 + 3 * 4")).toBe(14);
    expect(evalExpr("(2 + 3) * 4")).toBe(20);
  });

  it("تقسیم و باقی‌مانده", () => {
    expect(evalExpr("10 / 4")).toBe(2.5);
    expect(evalExpr("10 % 3")).toBe(1);
  });

  it("منفی یکانی", () => {
    expect(evalExpr("-5 + 10")).toBe(5);
    expect(evalExpr("-(2 + 3)")).toBe(-5);
  });

  it("عملگرهای مقایسه‌ای", () => {
    expect(evalExpr("5 > 3")).toBe(true);
    expect(evalExpr("5 >= 5")).toBe(true);
    expect(evalExpr("3 < 5")).toBe(true);
    expect(evalExpr("3 <= 3")).toBe(true);
    expect(evalExpr("3 == 3")).toBe(true);
    expect(evalExpr("3 != 4")).toBe(true);
  });

  it("AND/OR/NOT منطقی", () => {
    expect(evalExpr("1 > 0 AND 2 > 1")).toBe(true);
    expect(evalExpr("1 > 0 AND 2 < 1")).toBe(false);
    expect(evalExpr("1 < 0 OR 2 > 1")).toBe(true);
    expect(evalExpr("!(1 > 2)")).toBe(true);
  });

  it("AND اولویت بالاتر از OR دارد", () => {
    // false OR (true AND true) => true
    expect(evalExpr("1 > 2 OR 1 < 2 AND 3 > 1")).toBe(true);
  });
});

describe("FormulaParser + FormulaEvaluator — توابع پیش‌ساخته", () => {
  it("IF(cond, then, else) — طبق نمونه‌ی طراحی حق اولاد", () => {
    expect(evalExpr("IF(CHILDREN > 0, CHILDREN * CHILD_ALLOWANCE, 0)", { CHILDREN: 2, CHILD_ALLOWANCE: 500 })).toBe(
      1000,
    );
    expect(evalExpr("IF(CHILDREN > 0, CHILDREN * CHILD_ALLOWANCE, 0)", { CHILDREN: 0, CHILD_ALLOWANCE: 500 })).toBe(
      0,
    );
  });

  it("MIN/MAX — طبق نمونه‌ی طراحی سقف بیمه", () => {
    expect(evalExpr("MIN(INSURANCE_BASE * INSURANCE_RATE, INSURANCE_CEILING)", {
      INSURANCE_BASE: 1000,
      INSURANCE_RATE: 0.3,
      INSURANCE_CEILING: 200,
    })).toBe(200);
    expect(evalExpr("MAX(1, 5, 3)")).toBe(5);
  });

  it("ROUND با و بدون رقم اعشار", () => {
    expect(evalExpr("ROUND(3.456)")).toBe(3);
    expect(evalExpr("ROUND(3.456, 2)")).toBe(3.46);
  });

  it("FLOOR/CEIL/ABS", () => {
    expect(evalExpr("FLOOR(3.9)")).toBe(3);
    expect(evalExpr("CEIL(3.1)")).toBe(4);
    expect(evalExpr("ABS(-7)")).toBe(7);
  });

  it("PERCENT(value, pct)", () => {
    expect(evalExpr("PERCENT(2000, 9)")).toBe(180);
  });

  it("توابع تودرتو (Nested Formula)", () => {
    expect(evalExpr("ROUND(MIN(BASE * 1.1, CEILING), 0)", { BASE: 100, CEILING: 105 })).toBe(105);
  });
});

describe("FormulaEvaluator — خطاها", () => {
  it("متغیر ناموجود خطای واضح می‌دهد", () => {
    expect(() => evalExpr("MISSING_VAR + 1")).toThrow(FormulaEvaluationError);
    expect(() => evalExpr("MISSING_VAR + 1")).toThrow(/MISSING_VAR/);
  });

  it("تقسیم بر صفر", () => {
    expect(() => evalExpr("10 / 0")).toThrow(/تقسیم بر صفر/);
  });

  it("تابع ناشناخته", () => {
    expect(() => evalExpr("UNKNOWN_FN(1,2)")).toThrow(FormulaEvaluationError);
  });

  it("تعداد آرگومان اشتباه برای IF", () => {
    expect(() => evalExpr("IF(1>0, 1)")).toThrow(/IF/);
  });

  it("عملیات ریاضی روی boolean خطا می‌دهد", () => {
    expect(() => evalExpr("(1 > 0) + 1")).toThrow(FormulaEvaluationError);
  });
});

describe("FormulaParser — خطاهای نحوی با موقعیت دقیق", () => {
  it("پرانتز بسته‌نشده", () => {
    expect(() => new FormulaParser().parse("(1 + 2")).toThrow(FormulaSyntaxError);
  });

  it("کاراکتر غیرمجاز", () => {
    expect(() => new FormulaParser().parse("1 & 2")).toThrow(FormulaSyntaxError);
  });

  it("عبارت ناقص", () => {
    expect(() => new FormulaParser().parse("1 +")).toThrow(FormulaSyntaxError);
  });

  it("کاراکتر اضافی در انتها", () => {
    expect(() => new FormulaParser().parse("1 + 2 3")).toThrow(FormulaSyntaxError);
  });

  it("پیام خطا شامل موقعیت کاراکتر است", () => {
    try {
      new FormulaParser().parse("1 & 2");
      fail("باید خطا می‌داد");
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaSyntaxError);
      expect((e as FormulaSyntaxError).position).toBe(2);
    }
  });

  it("بدون eval یا Function سازنده در پیاده‌سازی استفاده نشده — امنیت پارسر", () => {
    const src = readFileSync(join(__dirname, "parser.ts"), "utf-8");
    const lexerSrc = readFileSync(join(__dirname, "lexer.ts"), "utf-8");
    const evalSrc = readFileSync(join(__dirname, "evaluator.ts"), "utf-8");
    expect(src + lexerSrc + evalSrc).not.toMatch(/\beval\s*\(/);
    expect(src + lexerSrc + evalSrc).not.toMatch(/new Function\s*\(/);
  });
});

describe("FormulaEvaluator.extractDependencies — مبنای Dependency Engine", () => {
  it("همه‌ی متغیرهای استفاده‌شده را برمی‌گرداند", () => {
    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    const node = parser.parse("IF(CHILDREN > 0, CHILDREN * CHILD_ALLOWANCE, BASE)");
    const deps = evaluator.extractDependencies(node).sort();
    expect(deps).toEqual(["BASE", "CHILDREN", "CHILD_ALLOWANCE"].sort());
  });

  it("فرمول ساده‌ی مونتاژ اجزا (GROSS = BASE+HOUSE+FOOD+CHILD+SENIORITY)", () => {
    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    const node = parser.parse("BASE + HOUSE + FOOD + CHILD + SENIORITY");
    expect(evaluator.extractDependencies(node).sort()).toEqual(
      ["BASE", "CHILD", "FOOD", "HOUSE", "SENIORITY"].sort(),
    );
  });

  it("بدون وابستگی برای فرمول فقط‌عددی", () => {
    const parser = new FormulaParser();
    const evaluator = new FormulaEvaluator();
    expect(evaluator.extractDependencies(parser.parse("100 * 2"))).toEqual([]);
  });
});
