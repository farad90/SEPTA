import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Repository Pattern — دسترسی خام به فرمول‌های ذخیره‌شده؛ Parse/Evaluate در Formula Engine انجام می‌شود. */
@Injectable()
export class FormulaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.formula.findUnique({ where: { id } });
  }

  findByCode(ruleVersionId: string, code: string) {
    return this.prisma.formula.findUnique({
      where: { ruleVersionId_code: { ruleVersionId, code } },
    });
  }

  listByRuleVersion(ruleVersionId: string) {
    return this.prisma.formula.findMany({ where: { ruleVersionId } });
  }

  upsert(
    ruleVersionId: string,
    code: string,
    data: { expression: string; description?: string | null },
  ) {
    return this.prisma.formula.upsert({
      where: { ruleVersionId_code: { ruleVersionId, code } },
      create: { ruleVersionId, code, ...data },
      update: data,
    });
  }
}
