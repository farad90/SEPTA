import { FormulaEngineService } from "./formula-engine.service";

describe("FormulaEngineService — کش parse", () => {
  it("parse نتیجه را به‌ازای formulaId کش می‌کند (فراخوانی دوم دوباره parse نمی‌کند)", () => {
    const service = new FormulaEngineService();
    const first = service.parse("f1", "BASE + 1");
    const second = service.parse("f1", "BASE + 1");
    expect(second).toBe(first); // همون شیء AST، نه فقط برابر
  });

  it("وقتی متن فرمول عوض بشه ولی formulaId عوض نشه، بدون invalidate همچنان نسخه‌ی کش‌شده‌ی قدیمی برمی‌گرده", () => {
    const service = new FormulaEngineService();
    service.parse("f1", "BASE + 1");
    const stale = service.parse("f1", "BASE + 999"); // متن جدید نادیده گرفته می‌شه چون هنوز کش‌شده
    expect(service.evaluate(stale, { BASE: 0 })).toBe(1); // نه 999
  });

  it("invalidate یک formulaId خاص باعث parse مجدد با متن تازه می‌شود", () => {
    const service = new FormulaEngineService();
    service.parse("f1", "BASE + 1");
    service.invalidate("f1");
    const fresh = service.parse("f1", "BASE + 999");
    expect(service.evaluate(fresh, { BASE: 0 })).toBe(999);
  });

  it("invalidateAll همه‌ی formulaId های کش‌شده را یک‌جا پاک می‌کند", () => {
    const service = new FormulaEngineService();
    service.parse("f1", "1");
    service.parse("f2", "2");

    service.invalidateAll();

    const fresh1 = service.parse("f1", "100");
    const fresh2 = service.parse("f2", "200");
    expect(service.evaluate(fresh1, {})).toBe(100);
    expect(service.evaluate(fresh2, {})).toBe(200);
  });

  it("parseUncached هیچ‌وقت کش نمی‌شود", () => {
    const service = new FormulaEngineService();
    const a = service.parseUncached("1 + 1");
    const b = service.parseUncached("1 + 1");
    expect(a).not.toBe(b); // هر بار یک AST جدید
  });
});
