import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CalculateEarningsStage } from "./stages/05-calculate-earnings.stage";
import { CalculateInsuranceBaseStage } from "./stages/06-calculate-insurance-base.stage";
import { CalculateTaxableIncomeStage } from "./stages/08-calculate-taxable-income.stage";
import { EvaluateComponentsStage } from "./stages/04-evaluate-components.stage";
import { EmployerCostStage } from "./stages/12-employer-cost.stage";
import { InsuranceStage } from "./stages/07-insurance.stage";
import { LoadEmployeeStage } from "./stages/02-load-employee.stage";
import { LoadRulesStage } from "./stages/01-load-rules.stage";
import { LoadWorkLogStage } from "./stages/03-load-worklog.stage";
import { NetSalaryStage } from "./stages/11-net-salary.stage";
import { OtherDeductionsStage } from "./stages/10-other-deductions.stage";
import { StoreResultStage } from "./stages/13-store-result.stage";
import { TaxStage } from "./stages/09-tax.stage";
import { createPipelineContext, PayrollPipelineContext } from "./pipeline-context";
import { PayrollPipelineStage } from "./stage.interface";

export interface PayrollCalculationOutcome {
  employeeId: string;
  status: "ok" | "error";
  resultId?: string;
  error?: string;
}

/**
 * Payroll Processor — تنها نقطه‌ی ورود برای اجرای Pipeline. ترتیب ۱۳ مرحله‌ی معماری مصوب
 * را دقیقاً همان‌طور که در سند طراحی آمده، بدون هیچ منطق محاسباتی در خود این کلاس، اجرا می‌کند.
 */
@Injectable()
export class PayrollProcessorService {
  private readonly stages: PayrollPipelineStage[];

  constructor(
    private readonly prisma: PrismaService,
    loadRules: LoadRulesStage,
    loadEmployee: LoadEmployeeStage,
    loadWorkLog: LoadWorkLogStage,
    evaluateComponents: EvaluateComponentsStage,
    calculateEarnings: CalculateEarningsStage,
    calculateInsuranceBase: CalculateInsuranceBaseStage,
    insurance: InsuranceStage,
    calculateTaxableIncome: CalculateTaxableIncomeStage,
    tax: TaxStage,
    otherDeductions: OtherDeductionsStage,
    netSalary: NetSalaryStage,
    employerCost: EmployerCostStage,
    storeResult: StoreResultStage,
  ) {
    this.stages = [
      loadRules,
      loadEmployee,
      loadWorkLog,
      evaluateComponents,
      calculateEarnings,
      calculateInsuranceBase,
      insurance,
      calculateTaxableIncome,
      tax,
      otherDeductions,
      netSalary,
      employerCost,
      storeResult,
    ];
  }

  async calculateForEmployee(payrollPeriodId: string, employeeId: string): Promise<PayrollPipelineContext> {
    const ctx = createPipelineContext(payrollPeriodId, employeeId);
    for (const stage of this.stages) {
      await stage.execute(ctx);
    }
    return ctx;
  }

  /** اجرای دسته‌جمعی برای همه‌ی کارمندهای دارای پروفایل حقوقی فعال — هر کارمند مستقل، شکست یکی بقیه را متوقف نمی‌کند. */
  async calculateForPeriod(payrollPeriodId: string): Promise<PayrollCalculationOutcome[]> {
    const employees = await this.prisma.employee.findMany({
      where: { employmentStatus: "active", payrollProfile: { isNot: null } },
      select: { id: true },
    });

    const outcomes: PayrollCalculationOutcome[] = [];
    for (const { id: employeeId } of employees) {
      try {
        const ctx = await this.calculateForEmployee(payrollPeriodId, employeeId);
        outcomes.push({ employeeId, status: "ok", resultId: ctx.savedResultId });
      } catch (err) {
        outcomes.push({ employeeId, status: "error", error: (err as Error).message });
      }
    }
    return outcomes;
  }
}
