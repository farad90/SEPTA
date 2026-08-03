export interface TaxBracket {
  bracketOrder: number;
  fromAmount: number;
  toAmount: number | null; // null = آخرین پله، بدون سقف
  ratePercent: number;
}

/** خروجی بارگذاری Rule Engine — نقشه‌ای ساده از code → مقدار عددی، به‌علاوه‌ی پله‌های مالیات */
export interface RuleSet {
  ruleVersionId: string;
  values: Record<string, number>;
  brackets: TaxBracket[];
}

export function getRuleValue(ruleSet: RuleSet, code: string, fallback = 0): number {
  return ruleSet.values[code] ?? fallback;
}
