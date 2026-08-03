import { Injectable } from "@nestjs/common";
import { getRuleValue, RuleSet } from "../rule-engine/rule-set.types";

/**
 * Tax Engine — مالیات پلکانی مستقل از Insurance Engine. معافیت و پله‌ها از RuleSet
 * خوانده می‌شوند؛ افزودن/حذف/تغییر یک پله یعنی فقط تغییر رکورد payroll_tax_brackets.
 */
@Injectable()
export class TaxEngineService {
  calculate(taxableIncome: number, rules: RuleSet): number {
    const exemption = getRuleValue(rules, "TAX_EXEMPTION");
    let remaining = Math.max(0, taxableIncome - exemption);
    let tax = 0;

    const brackets = [...rules.brackets].sort((a, b) => a.bracketOrder - b.bracketOrder);
    for (const bracket of brackets) {
      if (remaining <= 0) break;
      const bandSize = (bracket.toAmount ?? Number.POSITIVE_INFINITY) - bracket.fromAmount;
      const taxableInBand = Math.min(remaining, bandSize);
      if (taxableInBand <= 0) continue;
      tax += (taxableInBand * bracket.ratePercent) / 100;
      remaining -= taxableInBand;
    }

    return tax;
  }
}
