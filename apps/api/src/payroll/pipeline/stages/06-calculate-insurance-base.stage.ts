import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۶: جمع اجزایی که `is_insurable=true` دارند — مبنای محاسبه‌ی حق بیمه. */
@Injectable()
export class CalculateInsuranceBaseStage implements PayrollPipelineStage {
  readonly name = "calculate_insurance_base";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.insuranceBase = ctx.componentResults!.filter((c) => c.isInsurable).reduce((sum, c) => sum + c.amount, 0);
  }
}
