import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePayrollPeriodDto } from "./dto/payroll-period.dto";

@Injectable()
export class PayrollPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.legacyPayrollPeriod.findMany({
      include: { ourEntity: { select: { id: true, entityName: true } }, _count: { select: { payslips: true } } },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
  }

  async getById(id: string) {
    const period = await this.prisma.legacyPayrollPeriod.findUnique({
      where: { id },
      include: { ourEntity: { select: { id: true, entityName: true } } },
    });
    if (!period) {
      throw new NotFoundException("دوره حقوقی یافت نشد");
    }
    return period;
  }

  async create(dto: CreatePayrollPeriodDto) {
    return this.prisma.legacyPayrollPeriod.create({
      data: dto,
      include: { ourEntity: { select: { id: true, entityName: true } } },
    });
  }

  async finalize(id: string) {
    const period = await this.getById(id);
    if (period.status !== "draft") {
      throw new BadRequestException("فقط دوره در حالت پیش‌نویس قابل نهایی‌سازیه");
    }
    await this.prisma.legacyPayslip.updateMany({ where: { payrollPeriodId: id }, data: { status: "finalized" } });
    return this.prisma.legacyPayrollPeriod.update({
      where: { id },
      data: { status: "finalized", finalizedAt: new Date() },
    });
  }

  async markPaid(id: string) {
    const period = await this.getById(id);
    if (period.status !== "finalized") {
      throw new BadRequestException("فقط دوره نهایی‌شده قابل ثبت پرداخته");
    }
    await this.prisma.legacyPayslip.updateMany({ where: { payrollPeriodId: id }, data: { status: "paid" } });
    return this.prisma.legacyPayrollPeriod.update({ where: { id }, data: { status: "paid" } });
  }
}
