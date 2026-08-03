import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۱۲: هزینه‌ی تمام‌شده‌ی کارفرما = ناخالص + سهم بیمه‌ی کارفرما + بیمه‌ی بیکاری. */
@Injectable()
export class EmployerCostStage implements PayrollPipelineStage {
  readonly name = "employer_cost";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.employerCost =
      ctx.grossEarnings! + ctx.insuranceResult!.employerShare + ctx.insuranceResult!.unemploymentShare;
  }
}
