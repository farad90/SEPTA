import { Injectable } from "@nestjs/common";
import { ComponentEvaluatorService } from "../../engines/component-evaluator/component-evaluator.service";
import { ComponentDefinition } from "../../engines/component-evaluator/types";
import { PayrollComponentRepository } from "../../repositories/payroll-component.repository";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۴: ارزیابی همه‌ی اجزای فعال حقوق طبق فرمول خودشان (Component Evaluator). */
@Injectable()
export class EvaluateComponentsStage implements PayrollPipelineStage {
  readonly name = "evaluate_components";

  constructor(
    private readonly componentRepository: PayrollComponentRepository,
    private readonly componentEvaluator: ComponentEvaluatorService,
  ) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const components = await this.componentRepository.listActive();

    const definitions: ComponentDefinition[] = components.map((c) => ({
      id: c.id,
      code: c.code,
      componentType: c.componentType as "earning" | "deduction",
      isInsurable: c.isInsurable,
      isTaxable: c.isTaxable,
      calcOrder: c.calcOrder,
      formulaExpression: c.formula?.expression ?? null,
    }));

    const seedVariables = { ...ctx.ruleSet!.values, ...ctx.employeeInputs!, ...ctx.workLogInputs! };

    ctx.componentResults = this.componentEvaluator.evaluate(
      ctx.period!.ruleVersionId,
      definitions,
      seedVariables,
    );
  }
}
