import { Injectable } from "@nestjs/common";
import { FormulaNode } from "./ast";
import { FormulaContext, FormulaEvaluator, FormulaValue } from "./evaluator";
import { FormulaParser } from "./parser";

/**
 * نقطه‌ی ورود واحد به Formula Engine — Parse با کش (به‌ازای formulaId) + Evaluate + استخراج وابستگی.
 * Stateless نسبت به داده‌ی کسب‌وکار: فقط متن فرمول و Context را می‌گیرد، هیچ‌جا مستقیم به Prisma وصل نیست.
 */
@Injectable()
export class FormulaEngineService {
  private readonly parser = new FormulaParser();
  private readonly evaluator = new FormulaEvaluator();
  private readonly cache = new Map<string, FormulaNode>();

  parse(formulaId: string, expression: string): FormulaNode {
    const cached = this.cache.get(formulaId);
    if (cached) return cached;
    const node = this.parser.parse(expression);
    this.cache.set(formulaId, node);
    return node;
  }

  /** Parse بدون کش — برای پیش‌نمایش زنده در فرم ادمین قبل از ذخیره */
  parseUncached(expression: string): FormulaNode {
    return this.parser.parse(expression);
  }

  evaluate(node: FormulaNode, ctx: FormulaContext): FormulaValue {
    return this.evaluator.evaluate(node, ctx);
  }

  extractDependencies(node: FormulaNode): string[] {
    return this.evaluator.extractDependencies(node);
  }

  invalidate(formulaId: string): void {
    this.cache.delete(formulaId);
  }

  /** پاک کردن کامل کش — بعد از هر ویرایش ادمین روی فرمول‌ها/اجزا (نگاه کنید به PayrollConfigService). */
  invalidateAll(): void {
    this.cache.clear();
  }
}
