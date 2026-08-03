import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma";
import { PrismaService } from "../../prisma/prisma.service";

export interface PayrollResultTotals {
  grossEarnings: number;
  totalDeductions: number;
  insuranceEmployeeShare: number;
  insuranceEmployerShare: number;
  unemploymentInsurance: number;
  taxAmount: number;
  netSalary: number;
  employerCost: number;
}

export interface PayrollResultItemInput {
  componentId: string;
  componentCode: string;
  amount: number;
  calcOrder: number;
  formulaSnapshot: string | null;
}

/**
 * Repository Pattern — نوشتن/خواندن PayrollResult + PayrollResultItem. منطق محاسباتی
 * (این اعداد از کجا اومدن) کاملاً در Payroll Processor/Calculator است، نه اینجا.
 */
@Injectable()
export class PayrollResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.payrollResult.findUnique({
      where: { id },
      include: {
        items: { orderBy: { calcOrder: "asc" }, include: { component: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  /** برای مصرف‌کننده‌هایی که برای تولید سند فیش حقوقی به زمینه‌ی کامل کارمند/سازمان نیاز دارند. */
  findByIdForDocument(id: string) {
    return this.prisma.payrollResult.findUnique({
      where: { id },
      include: {
        items: { orderBy: { calcOrder: "asc" }, include: { component: true } },
        payrollPeriod: { select: { periodCode: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            positionTitle: true,
            department: { select: { departmentName: true } },
            ourEntity: { select: { entityName: true, address: true, phone: true, email: true, logoUrl: true } },
            contracts: {
              where: { status: "active" },
              take: 1,
              orderBy: { startDate: "desc" },
              select: { salaryCurrency: true },
            },
          },
        },
      },
    });
  }

  findByPeriodAndEmployee(payrollPeriodId: string, employeeId: string) {
    return this.prisma.payrollResult.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
      include: { items: { orderBy: { calcOrder: "asc" } } },
    });
  }

  listByPeriod(payrollPeriodId: string) {
    return this.prisma.payrollResult.findMany({
      where: { payrollPeriodId },
      include: {
        items: { orderBy: { calcOrder: "asc" } },
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  /** ذخیره‌ی نتیجه‌ی یک کارمند در یک دوره — Upsert کامل به‌همراه بازنویسی کل ردیف‌های اجزا در یک تراکنش. */
  async saveResult(
    payrollPeriodId: string,
    employeeId: string,
    totals: PayrollResultTotals,
    items: PayrollResultItemInput[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;

    const existing = await client.payrollResult.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
    });

    const result = existing
      ? await client.payrollResult.update({
          where: { id: existing.id },
          data: { ...totals, status: "calculated", calculatedAt: new Date() },
        })
      : await client.payrollResult.create({
          data: {
            payrollPeriodId,
            employeeId,
            ...totals,
            status: "calculated",
            calculatedAt: new Date(),
          },
        });

    await client.payrollResultItem.deleteMany({ where: { payrollResultId: result.id } });
    if (items.length > 0) {
      await client.payrollResultItem.createMany({
        data: items.map((item) => ({ payrollResultId: result.id, ...item })),
      });
    }

    return result;
  }

  updateStatus(
    id: string,
    status: string,
    actorId: string,
    stampField: "reviewedAt" | "approvedAt" | "postedAt" | "lockedAt",
    actorField: "reviewedBy" | "approvedBy" | "postedBy" | "lockedBy",
  ) {
    return this.prisma.payrollResult.update({
      where: { id },
      data: { status, [stampField]: new Date(), [actorField]: actorId },
    });
  }
}
