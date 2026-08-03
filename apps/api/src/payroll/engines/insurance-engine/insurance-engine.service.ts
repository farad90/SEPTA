import { Injectable } from "@nestjs/common";
import { getRuleValue, RuleSet } from "../rule-engine/rule-set.types";

export interface InsuranceResult {
  insuranceBase: number; // مبنای بیمه بعد از اعمال سقف
  employeeShare: number;
  employerShare: number;
  unemploymentShare: number;
  total: number;
}

/**
 * Insurance Engine — مستقل از Tax Engine. تمام نرخ‌ها و سقف از RuleSet خوانده می‌شوند؛
 * تغییر سالانه یعنی فقط رکورد جدید در payroll_rules، بدون تغییر این کد.
 */
@Injectable()
export class InsuranceEngineService {
  calculate(insurableBase: number, rules: RuleSet): InsuranceResult {
    const ceiling = getRuleValue(rules, "INSURANCE_CEILING", Number.POSITIVE_INFINITY);
    const base = Math.max(0, Math.min(insurableBase, ceiling));

    const employeeRate = getRuleValue(rules, "INSURANCE_RATE_EMPLOYEE");
    const employerRate = getRuleValue(rules, "INSURANCE_RATE_EMPLOYER");
    const unemploymentRate = getRuleValue(rules, "UNEMPLOYMENT_RATE");

    const employeeShare = (base * employeeRate) / 100;
    const employerShare = (base * employerRate) / 100;
    const unemploymentShare = (base * unemploymentRate) / 100;

    return {
      insuranceBase: base,
      employeeShare,
      employerShare,
      unemploymentShare,
      total: employeeShare + employerShare + unemploymentShare,
    };
  }
}
