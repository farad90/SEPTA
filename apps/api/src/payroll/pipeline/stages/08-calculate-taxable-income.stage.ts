import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/**
 * مرحله ۸: درآمد مشمول مالیات = جمع اجزای `is_taxable=true` منهای سهم بیمه‌ی کارگر —
 * ترتیب دقیقاً طبق پایپ‌لاین مصوب (Insurance قبل از Taxable Income می‌آید).
 */
@Injectable()
export class CalculateTaxableIncomeStage implements PayrollPipelineStage {
  readonly name = "calculate_taxable_income";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const taxableEarnings = ctx
      .componentResults!.filter((c) => c.isTaxable)
      .reduce((sum, c) => sum + c.amount, 0);

    ctx.taxableIncome = Math.max(0, taxableEarnings - ctx.insuranceResult!.employeeShare);
  }
}
