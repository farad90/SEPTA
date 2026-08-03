import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۵: جمع تمام اجزای نوع earning — مبنای حقوق ناخالص. */
@Injectable()
export class CalculateEarningsStage implements PayrollPipelineStage {
  readonly name = "calculate_earnings";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.grossEarnings = ctx
      .componentResults!.filter((c) => c.componentType === "earning")
      .reduce((sum, c) => sum + c.amount, 0);
  }
}
