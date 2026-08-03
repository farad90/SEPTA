import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RuleVersionNotFoundError } from "./errors";
import { RuleSet } from "./rule-set.types";

/**
 * Rule Engine — مسئولیتش فقط بارگذاری است، نه محاسبه. یک نسخه‌ی قانون را از دیتابیس
 * می‌خواند و به یک RuleSet ساده (code → مقدار) تبدیل می‌کند که بقیه‌ی Engine‌ها مصرف می‌کنند.
 */
@Injectable()
export class RuleEngineService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cache = new Map<string, RuleSet>();

  async loadByVersion(ruleVersionId: string): Promise<RuleSet> {
    const cached = this.cache.get(ruleVersionId);
    if (cached) return cached;

    const version = await this.prisma.payrollRuleVersion.findUnique({
      where: { id: ruleVersionId },
      include: { rules: true, brackets: { orderBy: { bracketOrder: "asc" } } },
    });
    if (!version) {
      throw new RuleVersionNotFoundError(ruleVersionId);
    }

    const values: Record<string, number> = {};
    for (const rule of version.rules) {
      values[rule.code] = Number(rule.value);
    }

    const ruleSet: RuleSet = {
      ruleVersionId,
      values,
      brackets: version.brackets.map((b) => ({
        bracketOrder: b.bracketOrder,
        fromAmount: Number(b.fromAmount),
        toAmount: b.toAmount != null ? Number(b.toAmount) : null,
        ratePercent: Number(b.ratePercent),
      })),
    };

    this.cache.set(ruleVersionId, ruleSet);
    return ruleSet;
  }

  invalidate(ruleVersionId: string): void {
    this.cache.delete(ruleVersionId);
  }
}
