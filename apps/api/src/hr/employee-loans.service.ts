import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { HrAccessService } from "./hr-access.service";
import { CreateEmployeeLoanDto } from "./dto/employee-loan.dto";

const LOAN_INCLUDE = {
  approver: { select: { id: true, fullName: true } },
  installments: { orderBy: { installmentNumber: "asc" as const } },
} satisfies Prisma.EmployeeLoanInclude;

function toDateOnly(d: string): Date {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

@Injectable()
export class EmployeeLoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: HrAccessService,
  ) {}

  async create(userId: string, dto: CreateEmployeeLoanDto) {
    const employee = await this.access.assertMyEmployee(userId);
    const monthlyInstallment = dto.loanAmount / dto.installmentCount;

    return this.prisma.employeeLoan.create({
      data: {
        employeeId: employee.id,
        loanAmount: dto.loanAmount,
        currencyCode: dto.currencyCode,
        installmentCount: dto.installmentCount,
        monthlyInstallment,
        startDeductionDate: toDateOnly(dto.startDeductionDate),
        reason: dto.reason,
      },
      include: LOAN_INCLUDE,
    });
  }

  async mine(userId: string) {
    const employee = await this.access.assertMyEmployee(userId);
    return this.prisma.employeeLoan.findMany({
      where: { employeeId: employee.id },
      include: LOAN_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async cancel(userId: string, id: string) {
    const employee = await this.access.assertMyEmployee(userId);
    const loan = await this.getOrThrow(id);
    if (loan.employeeId !== employee.id) {
      throw new BadRequestException("فقط ثبت‌کننده می‌تونه درخواست خودش رو لغو کنه");
    }
    if (loan.status !== "pending") {
      throw new BadRequestException("فقط درخواست در انتظار تأیید قابل لغوه");
    }
    // employee_loans.status مقدار 'cancelled' نداره (فقط pending/approved/active/settled/rejected)
    return this.prisma.employeeLoan.update({
      where: { id },
      data: { status: "rejected" },
      include: LOAN_INCLUDE,
    });
  }

  async pendingApproval(userId: string) {
    const manager = await this.access.assertMyEmployee(userId);
    return this.prisma.employeeLoan.findMany({
      where: { status: "pending", employee: { directManagerId: manager.id } },
      include: { ...LOAN_INCLUDE, employee: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /** تأیید → تولید خودکار اقساط ماهانه + status مستقیم به active (تصمیم ۲ SPEC-PHASE-20) */
  async approve(userId: string, id: string) {
    const loan = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, loan.employeeId);
    if (loan.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    if (!loan.startDeductionDate) {
      throw new BadRequestException("تاریخ شروع کسر اقساط مشخص نشده");
    }

    await this.prisma.employeeLoanInstallment.createMany({
      data: Array.from({ length: loan.installmentCount }, (_, i) => ({
        loanId: loan.id,
        installmentNumber: i + 1,
        dueDate: addMonths(loan.startDeductionDate!, i),
        amount: loan.monthlyInstallment,
      })),
    });

    return this.prisma.employeeLoan.update({
      where: { id },
      data: { status: "active", approverId: manager.id, approvedAt: new Date() },
      include: LOAN_INCLUDE,
    });
  }

  async reject(userId: string, id: string) {
    const loan = await this.getOrThrow(id);
    const { manager } = await this.access.assertIsDirectManagerOf(userId, loan.employeeId);
    if (loan.status !== "pending") {
      throw new BadRequestException("این درخواست دیگه در انتظار تأیید نیست");
    }
    return this.prisma.employeeLoan.update({
      where: { id },
      data: { status: "rejected", approverId: manager.id, approvedAt: new Date() },
      include: LOAN_INCLUDE,
    });
  }

  async listForEmployee(employeeId: string) {
    return this.prisma.employeeLoan.findMany({
      where: { employeeId },
      include: LOAN_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async getOrThrow(id: string) {
    const loan = await this.prisma.employeeLoan.findUnique({ where: { id } });
    if (!loan) {
      throw new NotFoundException("درخواست وام یافت نشد");
    }
    return loan;
  }
}
