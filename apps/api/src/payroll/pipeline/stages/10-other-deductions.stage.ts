import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";
import { ENGINE_MANAGED_COMPONENT_CODES } from "./component-codes";

/** مرحله ۱۰: جمع سایر کسورات (وام/مساعده/...) — به‌جز INSURANCE/TAX که Engine اختصاصی خودشان را دارند. */
@Injectable()
export class OtherDeductionsStage implements PayrollPipelineStage {
  readonly name = "other_deductions";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.otherDeductions = ctx
      .componentResults!.filter(
        (c) => c.componentType === "deduction" && !ENGINE_MANAGED_COMPONENT_CODES.has(c.code),
      )
      .reduce((sum, c) => sum + c.amount, 0);
  }
}
