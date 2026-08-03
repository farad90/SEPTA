import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Repository Pattern — تنها این لایه با Prisma برای «نسخه‌ی قانون» صحبت می‌کند؛
 * Rule Engine/Processor هیچ‌وقت مستقیم prisma.payrollRuleVersion را صدا نمی‌زنند.
 * بدون هیچ منطق محاسباتی — فقط دسترسی به داده.
 */
@Injectable()
export class PayrollRuleVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payrollRuleVersion.findUnique({
      where: { id },
      include: { rules: true, brackets: { orderBy: { bracketOrder: "asc" } }, formulas: true },
    });
  }

  listByYear(payrollYearId: string) {
    return this.prisma.payrollRuleVersion.findMany({
      where: { payrollYearId },
      orderBy: { versionNumber: "asc" },
    });
  }

  /** نسخه‌ای که در تاریخ مشخص‌شده معتبر است (status='active' و در بازه‌ی effectiveFrom/effectiveTo). */
  findActiveForDate(payrollYearId: string, date: Date) {
    return this.prisma.payrollRuleVersion.findFirst({
      where: {
        payrollYearId,
        status: "active",
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { versionNumber: "desc" },
    });
  }

  create(data: {
    payrollYearId: string;
    versionNumber: number;
    title: string;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    createdById?: string | null;
  }) {
    return this.prisma.payrollRuleVersion.create({ data });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.payrollRuleVersion.update({ where: { id }, data: { status } });
  }

  upsertRule(
    ruleVersionId: string,
    code: string,
    data: {
      title: string;
      valueType: string;
      value: string | number;
      effectiveDate: Date;
      expireDate?: Date | null;
      description?: string | null;
    },
  ) {
    return this.prisma.payrollRule.upsert({
      where: { ruleVersionId_code: { ruleVersionId, code } },
      create: { ruleVersionId, code, ...data },
      update: data,
    });
  }

  replaceBrackets(
    ruleVersionId: string,
    brackets: Array<{
      bracketOrder: number;
      fromAmount: string | number;
      toAmount?: string | number | null;
      ratePercent: string | number;
    }>,
  ) {
    return this.prisma.$transaction([
      this.prisma.payrollTaxBracket.deleteMany({ where: { ruleVersionId } }),
      this.prisma.payrollTaxBracket.createMany({
        data: brackets.map((b) => ({ ruleVersionId, ...b })),
      }),
    ]);
  }
}
