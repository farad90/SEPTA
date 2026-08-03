import { Injectable } from "@nestjs/common";
import { FormulaNode } from "../formula-engine/ast";
import { FormulaEngineService } from "../formula-engine/formula-engine.service";
import { DependencyGraph } from "./dependency-graph";

export interface ComponentDependencyInput {
  code: string;
  formulaNode: FormulaNode | null; // null یعنی این Component مقدار مستقیم دارد (مثلاً از EmployeePayrollProfile)، نه فرمول
}

@Injectable()
export class DependencyEngineService {
  constructor(private readonly formulaEngine: FormulaEngineService) {}

  private readonly orderCache = new Map<string, string[]>();

  buildGraph(components: ComponentDependencyInput[]): DependencyGraph {
    const graph = new DependencyGraph();
    const knownCodes = new Set(components.map((c) => c.code));

    for (const component of components) {
      graph.addNode(component.code);
      if (!component.formulaNode) continue;

      const deps = this.formulaEngine.extractDependencies(component.formulaNode);
      for (const dep of deps) {
        // فقط وابستگی بین دو Component را در گراف مدل می‌کنیم؛ ورودی‌های برگ
        // (WorkLog/Profile/Rule) وابستگی محاسباتی نیستند و در گراف نمی‌آیند
        if (knownCodes.has(dep) && dep !== component.code) {
          graph.addEdge(dep, component.code);
        }
      }
    }

    return graph;
  }

  /** ترتیب صحیح محاسبه برای یک نسخه‌ی قانون — Cache شده به‌ازای cacheKey (معمولاً ruleVersionId) */
  resolveOrder(cacheKey: string, components: ComponentDependencyInput[]): string[] {
    const cached = this.orderCache.get(cacheKey);
    if (cached) return cached;

    const graph = this.buildGraph(components);
    const order = graph.topologicalOrder();
    this.orderCache.set(cacheKey, order);
    return order;
  }

  invalidate(cacheKey: string): void {
    this.orderCache.delete(cacheKey);
  }

  /** پاک کردن کامل کش ترتیب محاسبه — بعد از هر ویرایش ادمین روی فرمول‌ها/اجزا. */
  invalidateAll(): void {
    this.orderCache.clear();
  }
}
