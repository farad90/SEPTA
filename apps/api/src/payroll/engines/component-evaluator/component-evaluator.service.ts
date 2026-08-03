import { Injectable } from "@nestjs/common";
import { ComponentDependencyInput, DependencyEngineService } from "../dependency-engine/dependency-engine.service";
import { FormulaContext, FormulaValue } from "../formula-engine/evaluator";
import { FormulaEngineService } from "../formula-engine/formula-engine.service";
import { ComponentEvaluationError } from "./errors";
import { ComponentDefinition, ComponentEvaluationResult } from "./types";

/**
 * Evaluate Components — یک لایه‌ی نازک روی Formula Engine + Dependency Engine:
 * ترتیب صحیح محاسبه را می‌گیرد، هر جزء را با فرمول خودش حساب می‌کند، و نتیجه‌ی هر جزء را
 * به Context اضافه می‌کند تا اجزای وابسته (مثلاً BONUS که به GROSS نیاز دارد) بتوانند آن را ببینند.
 */
@Injectable()
export class ComponentEvaluatorService {
  constructor(
    private readonly formulaEngine: FormulaEngineService,
    private readonly dependencyEngine: DependencyEngineService,
  ) {}

  evaluate(
    ruleVersionId: string,
    components: ComponentDefinition[],
    seedVariables: FormulaContext,
  ): ComponentEvaluationResult[] {
    const byCode = new Map(components.map((c) => [c.code, c]));
    const nodes = new Map(
      components.map((c) => [
        c.code,
        c.formulaExpression ? this.formulaEngine.parse(c.id, c.formulaExpression) : null,
      ]),
    );

    const dependencyInputs: ComponentDependencyInput[] = components.map((c) => ({
      code: c.code,
      formulaNode: nodes.get(c.code) ?? null,
    }));

    const order = this.dependencyEngine.resolveOrder(
      `${ruleVersionId}:${components.map((c) => c.code).join(",")}`,
      dependencyInputs,
    );

    const context: Record<string, FormulaValue> = { ...seedVariables };
    const results: ComponentEvaluationResult[] = [];

    for (const code of order) {
      const component = byCode.get(code);
      if (!component) continue; // نباید رخ دهد؛ فقط برای ایمنی نوع

      const node = nodes.get(code) ?? null;
      let amount = 0;

      if (node) {
        let value: FormulaValue;
        try {
          value = this.formulaEngine.evaluate(node, context);
        } catch (err) {
          throw new ComponentEvaluationError(code, err as Error);
        }
        if (typeof value !== "number") {
          throw new ComponentEvaluationError(
            code,
            new Error("فرمول باید یک مقدار عددی برگرداند، نه boolean"),
          );
        }
        amount = value;
      }

      context[code] = amount;
      results.push({
        componentId: component.id,
        code: component.code,
        componentType: component.componentType,
        isInsurable: component.isInsurable,
        isTaxable: component.isTaxable,
        calcOrder: component.calcOrder,
        amount,
        formulaSnapshot: component.formulaExpression,
      });
    }

    return results;
  }
}
