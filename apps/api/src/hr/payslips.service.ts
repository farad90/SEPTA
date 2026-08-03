import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";

const PAYSLIP_INCLUDE = {
  items: true,
  payrollPeriod: { select: { id: true, periodMonth: true, periodYear: true, ourEntityId: true } },
} satisfies Prisma.LegacyPayslipInclude;

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // آخرین روز ماه
  return { start, end };
}

@Injectable()
export class PayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async listForPeriod(payrollPeriodId: string) {
    return this.prisma.legacyPayslip.findMany({
      where: { payrollPeriodId },
      include: { ...PAYSLIP_INCLUDE, employee: { select: { id: true, fullName: true, employeeNumber: true } } },
      orderBy: { generatedAt: "desc" },
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.legacyPayslip.findMany({
      where: { employeeId },
      include: PAYSLIP_INCLUDE,
      orderBy: [{ generatedAt: "desc" }],
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.legacyPayslip.findMany({
      where: { employeeId: employee.id, status: { in: ["finalized", "paid"] } },
      include: PAYSLIP_INCLUDE,
      orderBy: [{ generatedAt: "desc" }],
    });
  }

  /** تولید/تولید مجدد فیش یک پرسنل — فقط روی فیش draft یا نبود فیش قبلی مجازه */
  async generate(payrollPeriodId: string, employeeId: string) {
    const period = await this.prisma.legacyPayrollPeriod.findUnique({ where: { id: payrollPeriodId } });
    if (!period) {
      throw new NotFoundException("دوره حقوقی یافت نشد");
    }
    if (period.status !== "draft") {
      throw new BadRequestException("این دوره نهایی/پرداخت‌شده — دیگه قابل تولید فیش نیست");
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("پرسنل یافت نشد");
    }

    const existing = await this.prisma.legacyPayslip.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
    });
    if (existing && existing.status !== "draft") {
      throw new BadRequestException("این فیش قفل شده — قابل تولید مجدد نیست");
    }

    const { start, end } = monthRange(period.periodYear, period.periodMonth);

    const contract = await this.prisma.employeeContract.findFirst({
      where: {
        employeeId,
        status: "active",
        startDate: { lte: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      orderBy: { startDate: "desc" },
    });
    if (!contract) {
      throw new BadRequestException("قرارداد فعالی برای این پرسنل در این دوره یافت نشد");
    }

    const benefits = await this.prisma.employeeBenefit.findMany({
      where: {
        employeeId,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      include: { benefitType: true },
    });

    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: { employeeId, status: "approved", workDate: { gte: start, lte: end }, calculatedAmount: { not: null } },
    });

    const deductions = await this.prisma.employeeDeduction.findMany({
      where: {
        employeeId,
        effectiveFrom: { lte: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
      },
      include: { deductionType: true },
    });

    const installments = await this.prisma.employeeLoanInstallment.findMany({
      where: { status: "pending", dueDate: { gte: start, lte: end }, loan: { employeeId } },
    });

    const baseSalary = Number(contract.baseSalary);
    const totalBenefits = benefits.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalOvertime = overtimeRecords.reduce((sum, o) => sum + Number(o.calculatedAmount), 0);
    const totalDeductions =
      deductions.reduce((sum, d) => sum + Number(d.amount), 0) +
      installments.reduce((sum, i) => sum + Number(i.amount), 0);
    const netAmount = baseSalary + totalBenefits + totalOvertime - totalDeductions;

    const items: { itemType: string; category: string; description?: string; amount: number }[] = [
      { itemType: "earning", category: "حقوق پایه", amount: baseSalary },
      ...benefits.map((b) => ({ itemType: "earning", category: b.benefitType.benefitName, amount: Number(b.amount) })),
      ...(totalOvertime > 0 ? [{ itemType: "earning", category: "اضافه‌کاری", amount: totalOvertime }] : []),
      ...deductions.map((d) => ({ itemType: "deduction", category: d.deductionType.deductionName, amount: Number(d.amount) })),
      ...installments.map((i) => ({
        itemType: "deduction",
        category: "قسط وام",
        description: `قسط ${i.installmentNumber}`,
        amount: Number(i.amount),
      })),
    ];

    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.employeeLoanInstallment.updateMany({
          where: { deductedInPayslipId: existing.id },
          data: { status: "pending", deductedInPayslipId: null },
        });
        await tx.legacyPayslip.delete({ where: { id: existing.id } });
      }

      const payslip = await tx.legacyPayslip.create({
        data: {
          payrollPeriodId,
          employeeId,
          baseSalary,
          totalBenefits,
          totalOvertime,
          totalDeductions,
          netAmount,
          currencyCode: contract.salaryCurrency,
          items: { create: items },
        },
        include: PAYSLIP_INCLUDE,
      });

      if (installments.length > 0) {
        await tx.employeeLoanInstallment.updateMany({
          where: { id: { in: installments.map((i) => i.id) } },
          data: { status: "deducted", deductedInPayslipId: payslip.id },
        });
      }

      return payslip;
    });
  }
}
