import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayrollPeriodRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: { payrollYear: true, ruleVersion: true },
    });
  }

  findByCode(periodCode: string) {
    return this.prisma.payrollPeriod.findUnique({ where: { periodCode } });
  }

  listByYear(payrollYearId: string) {
    return this.prisma.payrollPeriod.findMany({
      where: { payrollYearId },
      orderBy: { monthNumber: "asc" },
    });
  }

  create(data: { payrollYearId: string; periodCode: string; monthNumber: number; ruleVersionId: string }) {
    return this.prisma.payrollPeriod.create({ data });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.payrollPeriod.update({ where: { id }, data: { status } });
  }
}
