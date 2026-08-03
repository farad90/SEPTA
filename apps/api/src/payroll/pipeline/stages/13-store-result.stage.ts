import { Injectable } from "@nestjs/common";
import { PayrollResultItemInput, PayrollResultRepository } from "../../repositories/payroll-result.repository";
import { PayrollResultLockedError } from "../../workflow/errors";
import { isLocked } from "../../workflow/payroll-status";
import { PayrollPipelineContext } from "../pipeline-context";
import { PayrollPipelineStage } from "../stage.interface";
import { ENGINE_MANAGED_COMPONENT_CODES } from "./component-codes";

/**
 * مرحله ۱۳: ذخیره‌ی نتیجه‌ی نهایی. مبالغ INSURANCE/TAX روی ستون‌های اختصاصی PayrollResult
 * می‌روند نه PayrollResultItem (نگاه کنید به component-codes.ts) — این‌جا فقط ردیف‌های
 * برخاسته از فرمول (BASE/HOUSE/OVERTIME/LOAN/...) ذخیره می‌شوند.
 *
 * ⚠️ اگر نتیجه‌ی قبلیِ همین کارمند/دوره از قبل Locked باشد، بازمحاسبه رد می‌شود — طبق الزام
 * صریح معماری («پس از Locked هیچ تغییری مجاز نیست»). یک Trigger در پایگاه‌داده هم همین قانون
 * را به‌عنوان خط دفاعی دوم روی خود UPDATE اعمال می‌کند (نگاه کنید به Migration 0029).
 */
@Injectable()
export class StoreResultStage implements PayrollPipelineStage {
  readonly name = "store_result";

  constructor(private readonly resultRepository: PayrollResultRepository) {}

  async execute(ctx: PayrollPipelineContext): Promise<void> {
    const existing = await this.resultRepository.findByPeriodAndEmployee(ctx.payrollPeriodId, ctx.employeeId);
    if (existing && isLocked(existing.status)) {
      throw new PayrollResultLockedError(existing.id);
    }

    const totalDeductions = ctx.insuranceResult!.employeeShare + ctx.taxAmount! + ctx.otherDeductions!;

    const items: PayrollResultItemInput[] = ctx
      .componentResults!.filter((c) => !ENGINE_MANAGED_COMPONENT_CODES.has(c.code))
      .map((c, index) => ({
        componentId: c.componentId,
        componentCode: c.code,
        amount: c.amount,
        calcOrder: index + 1,
        formulaSnapshot: c.formulaSnapshot,
      }));

    const result = await this.resultRepository.saveResult(
      ctx.payrollPeriodId,
      ctx.employeeId,
      {
        grossEarnings: ctx.grossEarnings!,
        totalDeductions,
        insuranceEmployeeShare: ctx.insuranceResult!.employeeShare,
        insuranceEmployerShare: ctx.insuranceResult!.employerShare,
        unemploymentInsurance: ctx.insuranceResult!.unemploymentShare,
        taxAmount: ctx.taxAmount!,
        netSalary: ctx.netSalary!,
        employerCost: ctx.employerCost!,
      },
      items,
    );

    ctx.savedResultId = result.id;
  }
}
