import { FormulaParser } from "../formula-engine/parser";
import { FormulaEngineService } from "../formula-engine/formula-engine.service";
import { DependencyGraph } from "./dependency-graph";
import { DependencyEngineService, ComponentDependencyInput } from "./dependency-engine.service";
import { CircularDependencyError } from "./errors";

describe("DependencyGraph", () => {
  it("مرتب‌سازی توپولوژیک یک زنجیره‌ی خطی", () => {
    const graph = new DependencyGraph();
    graph.addEdge("A", "B");
    graph.addEdge("B", "C");
    expect(graph.topologicalOrder()).toEqual(["A", "B", "C"]);
  });

  it("مرتب‌سازی وابستگی لوزی‌شکل (Diamond) — طبق نمونه‌ی طراحی GROSS", () => {
    const graph = new DependencyGraph();
    graph.addEdge("BASE", "HOUSE");
    graph.addEdge("BASE", "SENIORITY");
    graph.addEdge("HOUSE", "GROSS");
    graph.addEdge("SENIORITY", "GROSS");
    graph.addEdge("FOOD", "GROSS");
    graph.addEdge("CHILD", "GROSS");

    const order = graph.topologicalOrder();
    expect(order.indexOf("BASE")).toBeLessThan(order.indexOf("HOUSE"));
    expect(order.indexOf("BASE")).toBeLessThan(order.indexOf("SENIORITY"));
    expect(order.indexOf("HOUSE")).toBeLessThan(order.indexOf("GROSS"));
    expect(order.indexOf("SENIORITY")).toBeLessThan(order.indexOf("GROSS"));
    expect(order.indexOf("FOOD")).toBeLessThan(order.indexOf("GROSS"));
    expect(order.indexOf("CHILD")).toBeLessThan(order.indexOf("GROSS"));
  });

  it("گره‌ی بدون یال هم در ترتیب حضور دارد", () => {
    const graph = new DependencyGraph();
    graph.addNode("ISOLATED");
    graph.addEdge("A", "B");
    expect(graph.topologicalOrder().sort()).toEqual(["A", "B", "ISOLATED"].sort());
  });

  it("چرخه‌ی مستقیم دوگره‌ای شناسایی و مسیر کامل گزارش می‌شود", () => {
    const graph = new DependencyGraph();
    graph.addEdge("CHILD", "BONUS");
    graph.addEdge("BONUS", "CHILD");

    expect(() => graph.topologicalOrder()).toThrow(CircularDependencyError);
    try {
      graph.topologicalOrder();
      fail("باید خطا می‌داد");
    } catch (e) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      const cycle = (e as CircularDependencyError).cycle;
      expect(cycle[0]).toBe(cycle[cycle.length - 1]);
      expect(cycle).toEqual(expect.arrayContaining(["CHILD", "BONUS"]));
    }
  });

  it("چرخه‌ی غیرمستقیم سه‌گره‌ای (A → B → C → A) شناسایی می‌شود", () => {
    const graph = new DependencyGraph();
    graph.addEdge("A", "B");
    graph.addEdge("B", "C");
    graph.addEdge("C", "A");

    expect(() => graph.topologicalOrder()).toThrow(/A → B → C → A|B → C → A → B|C → A → B → C/);
  });

  it("چرخه‌ی جزئی در یک گراف بزرگ‌تر هم شناسایی می‌شود (بقیه‌ی گراف سالم است)", () => {
    const graph = new DependencyGraph();
    graph.addEdge("BASE", "HOUSE"); // بخش سالم
    graph.addEdge("X", "Y"); // بخش دارای چرخه
    graph.addEdge("Y", "X");

    expect(() => graph.topologicalOrder()).toThrow(CircularDependencyError);
  });
});

describe("DependencyEngineService — یکپارچه با Formula Engine واقعی", () => {
  function buildComponents(defs: Record<string, string | null>): ComponentDependencyInput[] {
    const parser = new FormulaParser();
    return Object.entries(defs).map(([code, expression]) => ({
      code,
      formulaNode: expression ? parser.parse(expression) : null,
    }));
  }

  it("ترتیب صحیح را برای اجزای واقعی حقوق تعیین می‌کند", () => {
    const service = new DependencyEngineService(new FormulaEngineService());
    const components = buildComponents({
      BASE: null, // مقدار مستقیم از پروفایل
      HOUSE: "BASE * 0.1",
      SENIORITY: "BASE * 0.05",
      FOOD: null,
      CHILD: "IF(CHILDREN > 0, CHILDREN * CHILD_ALLOWANCE, 0)", // CHILDREN/CHILD_ALLOWANCE ورودی برگ‌اند، نه Component
      GROSS: "BASE + HOUSE + SENIORITY + FOOD + CHILD",
    });

    const order = service.resolveOrder("test-version-1", components);

    expect(order.indexOf("BASE")).toBeLessThan(order.indexOf("HOUSE"));
    expect(order.indexOf("BASE")).toBeLessThan(order.indexOf("SENIORITY"));
    expect(order.indexOf("HOUSE")).toBeLessThan(order.indexOf("GROSS"));
    expect(order.indexOf("CHILD")).toBeLessThan(order.indexOf("GROSS"));
    // CHILDREN/CHILD_ALLOWANCE ورودی‌های برگ‌اند و نباید گره‌ی گراف باشند
    expect(order).not.toContain("CHILDREN");
    expect(order).not.toContain("CHILD_ALLOWANCE");
  });

  it("وابستگی چرخه‌ای بین دو Component واقعی را رد می‌کند", () => {
    const service = new DependencyEngineService(new FormulaEngineService());
    const components = buildComponents({
      CHILD: "BONUS * 0.1",
      BONUS: "CHILD * 0.1",
    });

    expect(() => service.resolveOrder("cyclic-version", components)).toThrow(CircularDependencyError);
  });

  it("نتیجه به‌ازای cacheKey کش می‌شود", () => {
    const formulaEngine = new FormulaEngineService();
    const extractSpy = jest.spyOn(formulaEngine, "extractDependencies");
    const service = new DependencyEngineService(formulaEngine);
    const components = buildComponents({ BASE: null, HOUSE: "BASE * 0.1" });

    service.resolveOrder("cached-version", components);
    const callsAfterFirst = extractSpy.mock.calls.length;
    service.resolveOrder("cached-version", components);
    expect(extractSpy.mock.calls.length).toBe(callsAfterFirst); // بار دوم از کش آمده، دوباره extract نشده

    service.invalidate("cached-version");
    service.resolveOrder("cached-version", components);
    expect(extractSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst); // بعد از invalidate دوباره محاسبه شده
  });

  it("invalidateAll کش همه‌ی cacheKey ها را یک‌جا پاک می‌کند", () => {
    const formulaEngine = new FormulaEngineService();
    const extractSpy = jest.spyOn(formulaEngine, "extractDependencies");
    const service = new DependencyEngineService(formulaEngine);
    const components = buildComponents({ BASE: null, HOUSE: "BASE * 0.1" });

    service.resolveOrder("version-a", components);
    service.resolveOrder("version-b", components);
    const callsAfterFirst = extractSpy.mock.calls.length;

    service.invalidateAll();
    service.resolveOrder("version-a", components);
    service.resolveOrder("version-b", components);

    expect(extractSpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
