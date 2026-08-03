import { Injectable } from "@nestjs/common";
import { TaxEngineService } from "../../engines/tax-engine/tax-engine.service";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۹: محاسبه‌ی مالیات پلکانی روی درآمد مشمول — Tax Engine. */
@Injectable()
export class TaxStage implements PayrollPipelineStage {
  readonly name = "tax";

  constructor(private readonly taxEngine: TaxEngineService) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.taxAmount = this.taxEngine.calculate(ctx.taxableIncome!, ctx.ruleSet!);
  }
}
