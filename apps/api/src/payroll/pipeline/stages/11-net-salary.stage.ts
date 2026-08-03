import { Injectable } from "@nestjs/common";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";

/** مرحله ۱۱: خالص پرداختی = ناخالص − سهم بیمه‌ی کارگر − مالیات − سایر کسورات. */
@Injectable()
export class NetSalaryStage implements PayrollPipelineStage {
  readonly name = "net_salary";

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    ctx.netSalary =
      ctx.grossEarnings! - ctx.insuranceResult!.employeeShare - ctx.taxAmount! - ctx.otherDeductions!;
  }
}
