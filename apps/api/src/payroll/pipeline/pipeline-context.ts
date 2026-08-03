import { ComponentEvaluationResult } from "../engines/component-evaluator/types";
import { InsuranceResult } from "../engines/insurance-engine/insurance-engine.service";
import { FormulaValue } from "../engines/formula-engine/evaluator";
import { RuleSet } from "../engines/rule-engine/rule-set.types";

export interface PayrollPeriodSnapshot {
  id: string;
  monthNumber: number;
  yearNumber: number;
  calendarType: string;
  ruleVersionId: string;
}

/**
 * حالت درحال‌گردش یک اجرای Pipeline برای «یک کارمند در یک دوره». هر Stage فقط فیلدهایی
 * که مسئولیت خودش است را می‌نویسد و فیلدهای قبلی را می‌خواند — به همان ترتیب ثابتی که
 * در معماری مصوب آمده: Load Rules → Load Employee → Load WorkLog → Evaluate Components →
 * Calculate Earnings → Calculate Insurance Base → Insurance → Calculate Taxable Income →
 * Tax → Other Deductions → Net Salary → Employer Cost → Store Result.
 */
export interface PayrollPipelineContext {
  readonly payrollPeriodId: string;
  readonly employeeId: string;

  period?: PayrollPeriodSnapshot;
  ruleSet?: RuleSet;

  employeeInputs?: Record<string, FormulaValue>;
  currencyCode?: string;

  workLogInputs?: Record<string, FormulaValue>;

  componentResults?: ComponentEvaluationResult[];

  grossEarnings?: number;
  insuranceBase?: number;
  insuranceResult?: InsuranceResult;
  taxableIncome?: number;
  taxAmount?: number;
  otherDeductions?: number;
  netSalary?: number;
  employerCost?: number;

  savedResultId?: string;
}

export function createPipelineContext(payrollPeriodId: string, employeeId: string): PayrollPipelineContext {
  return { payrollPeriodId, employeeId };
}
