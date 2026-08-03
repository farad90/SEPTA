import { Injectable } from "@nestjs/common";
import { InsuranceEngineService } from "../../engines/insurance-engine/insurance-engine.service";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۷: محاسبه‌ی سهم بیمه (کارگر/کارفرما/بیکاری) روی مبنای بیمه — Insurance Engine. */
@Injectable()
export class InsuranceStage implements PayrollPipelineStage {
  readonly name = "insurance";

  constructor(private readonly insuranceEngine: InsuranceEngineService) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.insuranceResult = this.insuranceEngine.calculate(ctx.insuranceBase!, ctx.ruleSet!);
  }
}
